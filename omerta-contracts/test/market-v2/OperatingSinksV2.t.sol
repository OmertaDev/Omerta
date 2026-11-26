// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {OmertaRestrictedOMRV2} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {IOmertaRestrictedOMRV2} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {OmertaOperatingSinksV2, IOperatingCustodyV2} from "../../src/market-v2/OmertaOperatingSinksV2.sol";
import {
    OmertaGameCustodyV2,
    IGameCustodyTokenV2,
    IGameCustodyGenesisV2,
    IGameOperatingSinkV2
} from "../../src/market-v2/OmertaGameCustodyV2.sol";

contract OperatingGenesisFixtureV2 {
    address public immutable omr;
    address public immutable treasury;
    bool public constant playerClaimsOpen = true;

    constructor(address token, address safe) {
        omr = token;
        treasury = safe;
    }
}

contract OperatingManagerFixtureV2 {
    address public immutable omr;
    uint16 public constant TRADE_FEE_BPS = 400;
    bool public constant settlementPoolConfigured = true;

    constructor(address token) {
        omr = token;
    }

    function revenuePolicyId() external pure returns (bytes32) {
        return keccak256("OMERTA_RESTRICTED_LP_REVENUE_V2_350_BASE_50_ETH_STAKERS_BOTH_DIRECTIONS");
    }
}

contract OperatingWrongOwnerFixtureV2 {
    address public immutable omr;
    address public constant owner = address(0xB0B);

    constructor(address token) {
        omr = token;
    }
}

abstract contract OperatingSinksV2Fixture is Test {
    OmertaRestrictedOMRV2 token;
    OmertaGameCustodyV2 custody;
    OmertaOperatingSinksV2 sink;
    uint256 constant WITHDRAW_KEY = 0xABCD01;
    uint256 constant OPERATING_KEY = 0xABCD02;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    bytes32 constant ACCOUNT = keccak256("alice-account");

    function setUp() public virtual {
        vm.warp(10 days);
        token = new OmertaRestrictedOMRV2(address(this));
        OperatingGenesisFixtureV2 genesis = new OperatingGenesisFixtureV2(address(token), address(this));
        custody = new OmertaGameCustodyV2(
            address(this),
            vm.addr(WITHDRAW_KEY),
            IGameCustodyTokenV2(address(token)),
            IGameCustodyGenesisV2(address(genesis)),
            1_000 ether
        );
        sink = new OmertaOperatingSinksV2(
            address(this),
            vm.addr(OPERATING_KEY),
            IOmertaRestrictedOMRV2(address(token)),
            address(this),
            IOperatingCustodyV2(address(custody))
        );
        OperatingManagerFixtureV2 manager = new OperatingManagerFixtureV2(address(token));
        token.bindSettlementManager(address(manager), address(manager).codehash);
        token.setOperator(
            address(custody), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(custody).codehash
        );
        token.setOperator(address(sink), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(sink).codehash);
        vm.prank(alice, alice);
        token.registerWallet(alice);
        vm.prank(bob, bob);
        token.registerWallet(bob);
        token.sealPolicy();
        custody.bindOperatingSink(IGameOperatingSinkV2(address(sink)), 50 ether);
        custody.setRequiredReserve(1_000 ether);
        token.approve(address(custody), type(uint256).max);
        custody.fundReserve(1_000 ether);
        custody.activate();
        sink.activate();
        OmertaGameCustodyV2.Voucher memory v =
            OmertaGameCustodyV2.Voucher(alice, 100 ether, 0, 0, 1, block.timestamp + 1 days);
        custody.claim(v, signHash(WITHDRAW_KEY, custody.hashVoucher(v)));
        vm.prank(alice);
        token.approve(address(sink), type(uint256).max);
    }

    function quote(uint8 action, uint256 nonce, uint256 amount)
        internal
        view
        returns (OmertaOperatingSinksV2.Quote memory)
    {
        return OmertaOperatingSinksV2.Quote(
            alice,
            ACCOUNT,
            action,
            keccak256(abi.encode("operation", nonce)),
            amount,
            nonce,
            block.timestamp + 5 minutes
        );
    }

    function signHash(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function signQuote(OmertaOperatingSinksV2.Quote memory q, bool fromCustody) internal view returns (bytes memory) {
        return signHash(OPERATING_KEY, fromCustody ? sink.hashCustodyQuote(q) : sink.hashQuote(q));
    }

    function custodyQuote(uint8 action, uint256 nonce, uint256 amount)
        internal
        view
        returns (OmertaOperatingSinksV2.Quote memory q)
    {
        q = quote(action, nonce, amount);
        q.payer = address(custody);
    }

    function expectInvalidCustody(OmertaOperatingSinksV2.Quote memory q, bytes memory signature) internal {
        vm.expectRevert(OmertaOperatingSinksV2.InvalidQuote.selector);
        sink.settleCustody(q, signature);
    }

    function expectCustodyFailure(OmertaOperatingSinksV2.Quote memory q, bytes4 selector) internal {
        bytes memory signature = signQuote(q, true);
        vm.expectRevert(selector);
        sink.settleCustody(q, signature);
    }
}

contract OperatingSinksV2Test is OperatingSinksV2Fixture {
    function testAllSevenActionsExecuteRestrictedTokenPayments() public {
        uint256 recipientBefore = token.balanceOf(address(this));
        for (uint8 action = 0; action <= 6; ++action) {
            OmertaOperatingSinksV2.Quote memory q = quote(action, action + 10, 1 ether);
            bytes memory signature = signQuote(q, false);
            vm.prank(alice);
            sink.pay(q, signature);
            assertEq(sink.paidByAction(action), 1 ether);
            assertTrue(sink.usedOperation(q.operationId));
        }
        assertEq(token.balanceOf(alice), 93 ether);
        assertEq(token.balanceOf(address(this)), recipientBefore + 7 ether);
        assertEq(token.balanceOf(address(sink)), 0);
        assertEq(sink.cumulativePaid(), 7 ether);
        assertEq(token.totalSupply(), 100_000_000 ether);
    }

    function testCustodyPaymentsRetireDeclaredLiabilitiesWithoutWalletDebit() public {
        uint256 walletBefore = token.balanceOf(alice);
        uint256 recipientBefore = token.balanceOf(address(this));
        for (uint8 action = 0; action <= 6; ++action) {
            OmertaOperatingSinksV2.Quote memory q = custodyQuote(action, action + 20, 1 ether);
            sink.settleCustody(q, signQuote(q, true));
            assertTrue(custody.usedOperatingOperation(q.operationId));
        }
        assertEq(token.balanceOf(alice), walletBefore);
        assertEq(token.balanceOf(address(custody)), 893 ether);
        assertEq(token.balanceOf(address(this)), recipientBefore + 7 ether);
        assertEq(custody.cumulativeOperatingSettled(), 7 ether);
        assertEq(custody.cumulativeClaimed(), 100 ether);
        assertEq(custody.cumulativeFunded(), 1_000 ether);
        assertEq(token.balanceOf(address(sink)), 0);
    }

    function testQuoteRequiresPayerConsentEvenWithStandingAllowance() public {
        OmertaOperatingSinksV2.Quote memory q = quote(0, 40, 2 ether);
        bytes memory signature = signQuote(q, false);
        vm.prank(bob);
        vm.expectRevert(OmertaOperatingSinksV2.InvalidQuote.selector);
        sink.pay(q, signature);
        assertFalse(sink.usedOperation(q.operationId));
    }

    function testCustodyQuotesRequireTheBoundVaultAsPayer() public {
        OmertaOperatingSinksV2.Quote memory q = quote(0, 39, 2 ether);
        expectInvalidCustody(q, signQuote(q, true));
        assertEq(custody.cumulativeOperatingSettled(), 0);
        assertFalse(sink.usedOperation(q.operationId));
    }

    function testConstructorRejectsDifferentCustodyOwner() public {
        OperatingWrongOwnerFixtureV2 wrong = new OperatingWrongOwnerFixtureV2(address(token));
        vm.expectRevert(OmertaOperatingSinksV2.InvalidConfiguration.selector);
        new OmertaOperatingSinksV2(
            address(this),
            vm.addr(OPERATING_KEY),
            IOmertaRestrictedOMRV2(address(token)),
            address(this),
            IOperatingCustodyV2(address(wrong))
        );
    }

    function testNonceAndOperationReplayAcrossBothModes() public {
        OmertaOperatingSinksV2.Quote memory q = quote(1, 41, 2 ether);
        bytes memory signature = signQuote(q, false);
        vm.prank(alice);
        sink.pay(q, signature);
        vm.prank(alice);
        vm.expectRevert(OmertaOperatingSinksV2.InvalidQuote.selector);
        sink.pay(q, signature);
        q.payer = address(custody);
        expectInvalidCustody(q, signQuote(q, true));
        q.nonce = 42;
        expectInvalidCustody(q, signQuote(q, true));
        q.operationId = keccak256("second-operation");
        sink.settleCustody(q, signQuote(q, true));
        q.operationId = keccak256("third-operation");
        expectInvalidCustody(q, signQuote(q, true));
        assertEq(sink.cumulativePaid(), 4 ether);
    }

    function testPaymentModesHaveSeparateSignatureDomains() public {
        OmertaOperatingSinksV2.Quote memory q = custodyQuote(2, 43, 2 ether);
        expectInvalidCustody(q, signQuote(q, false));
        bytes memory custodySignature = signQuote(q, true);
        vm.prank(alice);
        vm.expectRevert(OmertaOperatingSinksV2.InvalidQuote.selector);
        sink.pay(q, custodySignature);
    }

    function testEveryQuotedFieldIsBound() public {
        OmertaOperatingSinksV2.Quote memory q = custodyQuote(3, 44, 2 ether);
        bytes memory signature = signQuote(q, true);
        q.action = 4;
        vm.expectRevert(OmertaOperatingSinksV2.InvalidQuote.selector);
        sink.settleCustody(q, signature);
        q.action = 3;
        q.accountId = keccak256("other-account");
        vm.expectRevert(OmertaOperatingSinksV2.InvalidQuote.selector);
        sink.settleCustody(q, signature);
        q.accountId = ACCOUNT;
        q.amount += 1e12;
        vm.expectRevert(OmertaOperatingSinksV2.InvalidQuote.selector);
        sink.settleCustody(q, signature);
        q.amount -= 1e12;
        q.payer = bob;
        vm.expectRevert(OmertaOperatingSinksV2.InvalidQuote.selector);
        sink.settleCustody(q, signature);
        q.payer = address(custody);
        q.operationId = keccak256("other-operation");
        vm.expectRevert(OmertaOperatingSinksV2.InvalidQuote.selector);
        sink.settleCustody(q, signature);
    }

    function testQuoteRejectsWrongSignerAndChain() public {
        OmertaOperatingSinksV2.Quote memory q = custodyQuote(4, 45, 2 ether);
        expectInvalidCustody(q, signHash(WITHDRAW_KEY, sink.hashCustodyQuote(q)));
        bytes memory signature = signQuote(q, true);
        vm.chainId(block.chainid + 1);
        vm.expectRevert(OmertaOperatingSinksV2.InvalidQuote.selector);
        sink.settleCustody(q, signature);
    }

    function testQuoteRejectsExpiryLongDeadlineUnknownActionAndDust() public {
        OmertaOperatingSinksV2.Quote memory q = custodyQuote(5, 46, 2 ether);
        q.deadline = block.timestamp - 1;
        expectInvalidCustody(q, signQuote(q, true));
        q.deadline = block.timestamp + sink.MAX_QUOTE_TTL() + 1;
        expectInvalidCustody(q, signQuote(q, true));
        q.deadline = block.timestamp + 1;
        q.action = 7;
        expectInvalidCustody(q, signQuote(q, true));
        q.action = 5;
        q.amount = 1;
        expectInvalidCustody(q, signQuote(q, true));
        q.amount = 0;
        expectInvalidCustody(q, signQuote(q, true));
    }

    function testCustodyDailyCapRollsBackBothContractsAndResetsNextDay() public {
        OmertaOperatingSinksV2.Quote memory q = custodyQuote(6, 47, 50 ether);
        sink.settleCustody(q, signQuote(q, true));
        q = custodyQuote(6, 48, 1 ether);
        expectCustodyFailure(q, OmertaGameCustodyV2.DailyCapExceeded.selector);
        assertFalse(sink.usedOperation(q.operationId));
        assertFalse(custody.usedOperatingOperation(q.operationId));
        assertEq(custody.cumulativeOperatingSettled(), 50 ether);
        vm.warp(block.timestamp + 1 days);
        q.deadline = vm.getBlockTimestamp() + 5 minutes;
        sink.settleCustody(q, signQuote(q, true));
        assertEq(custody.cumulativeOperatingSettled(), 51 ether);
    }

    function testCustodyRejectsUnauthorizedCallerAndRuntimeDrift() public {
        vm.prank(alice);
        vm.expectRevert(OmertaGameCustodyV2.NotReady.selector);
        custody.settleOperatingCost(keccak256("unauthorized"), 1 ether);
        vm.etch(address(sink), hex"00");
        vm.prank(address(sink));
        vm.expectRevert(OmertaGameCustodyV2.NotReady.selector);
        custody.settleOperatingCost(keccak256("changed-runtime"), 1 ether);
    }

    function testCustodyBindingIsOneTimeAndCannotChangeAfterActivation() public {
        vm.expectRevert(OmertaGameCustodyV2.InvalidConfiguration.selector);
        custody.bindOperatingSink(IGameOperatingSinkV2(address(sink)), 100 ether);
        assertEq(custody.operatingSink(), address(sink));
        assertEq(custody.operatingDailyCapOMR(), 50 ether);
    }

    function testPauseAndOwnerBoundariesPreserveUnspentQuotes() public {
        OmertaOperatingSinksV2.Quote memory q = custodyQuote(0, 49, 2 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        sink.pause();
        sink.pause();
        expectCustodyFailure(q, Pausable.EnforcedPause.selector);
        sink.unpause();
        custody.pause();
        expectCustodyFailure(q, Pausable.EnforcedPause.selector);
        assertFalse(sink.usedOperation(q.operationId));
        custody.unpause();
        sink.settleCustody(q, signQuote(q, true));
    }

    function testDepositsClaimsAndOperatingSettlementDoNotDoubleCountFunding() public {
        vm.prank(alice);
        token.approve(address(custody), 10 ether);
        vm.prank(alice);
        custody.deposit(10 ether);
        custody.fundReserve(20 ether);
        OmertaOperatingSinksV2.Quote memory q = custodyQuote(0, 50, 2 ether);
        sink.settleCustody(q, signQuote(q, true));
        assertEq(custody.cumulativeFunded(), 1_030 ether);
        assertEq(custody.cumulativeReserveFunded(), 1_020 ether);
        assertEq(custody.cumulativeClaimed(), 100 ether);
        assertEq(custody.cumulativeOperatingSettled(), 2 ether);
        assertEq(token.balanceOf(address(custody)), 928 ether);
    }

    function testFuzzCustodySettlementConservesSupply(uint64 micros, uint8 action) public {
        uint256 amount = bound(uint256(micros), 1, 50_000_000) * 1e12;
        action = uint8(bound(action, 0, 6));
        OmertaOperatingSinksV2.Quote memory q = custodyQuote(action, 51, amount);
        uint256 beforeSum = token.balanceOf(address(this)) + token.balanceOf(address(custody)) + token.balanceOf(alice);
        sink.settleCustody(q, signQuote(q, true));
        assertEq(token.balanceOf(address(this)) + token.balanceOf(address(custody)) + token.balanceOf(alice), beforeSum);
        assertEq(token.totalSupply(), 100_000_000 ether);
        assertEq(token.balanceOf(address(sink)), 0);
    }
}
