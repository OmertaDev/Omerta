// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {OmertaRestrictedOMRV2} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {IOmertaRestrictedOMRV2} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {OmertaGameCustodyV2, IGameCustodyTokenV2, IGameCustodyGenesisV2} from "../../src/market-v2/OmertaGameCustodyV2.sol";

contract GameCustodyGenesisFixture {
    address public immutable omr;
    address public immutable treasury;
    bool public playerClaimsOpen;
    constructor(address token, address safe) { omr = token; treasury = safe; }
    function setReady(bool ready) external { playerClaimsOpen = ready; }
}

contract GameCustodyManagerFixture {
    address public immutable omr;
    uint16 public constant TRADE_FEE_BPS = 400;
    constructor(address token) { omr = token; }
    function revenuePolicyId() external pure returns (bytes32) {
        return keccak256("OMERTA_RESTRICTED_LP_REVENUE_V2_350_BASE_50_BTC_REWARDS_BOTH_DIRECTIONS");
    }
}

contract GameCustodyV2Test is Test {
    OmertaRestrictedOMRV2 token;
    GameCustodyGenesisFixture genesis;
    OmertaGameCustodyV2 vault;
    uint256 constant SIGNER_KEY = 0x123456;
    address signer;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    uint256 initialChain;

    function setUp() public {
        vm.warp(10 days);
        initialChain = block.chainid;
        signer = vm.addr(SIGNER_KEY);
        token = new OmertaRestrictedOMRV2(address(this));
        genesis = new GameCustodyGenesisFixture(address(token), address(this));
        vault = new OmertaGameCustodyV2(address(this), signer,
            IGameCustodyTokenV2(address(token)), IGameCustodyGenesisV2(address(genesis)), 100 ether);
        GameCustodyManagerFixture manager = new GameCustodyManagerFixture(address(token));
        token.bindSettlementManager(address(manager), address(manager).codehash);
        token.setOperator(address(vault), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(vault).codehash);
        vm.prank(alice, alice); token.registerWallet(alice);
        vm.prank(bob, bob); token.registerWallet(bob);
        token.sealPolicy();
        token.approve(address(vault), type(uint256).max);
    }

    function ready() internal {
        genesis.setReady(true);
        vault.setRequiredReserve(1e12);
        vault.fundReserve(1e12);
        vault.activate();
    }
    function voucher(uint256 amount, uint256 nonce) internal view returns (OmertaGameCustodyV2.Voucher memory) {
        return OmertaGameCustodyV2.Voucher(alice, amount, 0, 0, nonce, block.timestamp + 1 days);
    }
    function signature(OmertaGameCustodyV2.Voucher memory v) internal view returns (bytes memory) {
        bytes32 domain = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("OmertaVoucherClaim"), keccak256("1"), block.chainid, address(vault)));
        bytes32 payload = keccak256(abi.encode(
            keccak256("Voucher(address to,uint256 amount,uint8 kind,uint256 gearId,uint256 nonce,uint256 deadline)"),
            v.to, v.amount, v.kind, v.gearId, v.nonce, v.deadline));
        (uint8 v_, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, keccak256(abi.encodePacked("\x19\x01", domain, payload)));
        return abi.encodePacked(r, s, v_);
    }

    function testRequiresSuccessfulMigrationAndClaimCliff() public {
        vm.expectRevert(OmertaGameCustodyV2.NotReady.selector); vault.activate();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)); vault.activate();
        ready();
        vm.expectRevert(OmertaGameCustodyV2.NotReady.selector); vault.activate();
    }

    function testActivationRequiresExplicitTreasuryBaselineAndFreezesIt() public {
        genesis.setReady(true);
        vm.expectRevert(OmertaGameCustodyV2.NotReady.selector); vault.activate();
        vault.setRequiredReserve(10 ether);
        vault.fundReserve(9 ether);
        vm.expectRevert(OmertaGameCustodyV2.NotReady.selector); vault.activate();
        vault.fundReserve(1 ether); vault.activate();
        assertEq(vault.requiredReserve(),10 ether); assertEq(vault.cumulativeReserveFunded(),10 ether);
        vm.expectRevert(OmertaGameCustodyV2.InvalidConfiguration.selector); vault.setRequiredReserve(11 ether);
    }

    function testRealRestrictedTokenFundingWithdrawalAndDepositRoundtrip() public {
        ready();
        vault.fundReserve(80 ether);
        OmertaGameCustodyV2.Voucher memory v = voucher(40 ether, 1);
        vault.claim(v, signature(v));
        assertEq(token.balanceOf(alice), 40 ether);
        vm.startPrank(alice, alice);
        token.approve(address(vault), 10 ether);
        vault.deposit(10 ether);
        vm.stopPrank();
        assertEq(token.balanceOf(alice), 30 ether);
        assertEq(token.balanceOf(address(vault)), 50 ether + 1e12);
        assertEq(vault.cumulativeFunded(), 90 ether + 1e12);
        assertEq(vault.cumulativeClaimed(), 40 ether);
        assertEq(token.totalSupply(), 100_000_000 ether);
        vm.expectRevert(OmertaGameCustodyV2.InvalidVoucher.selector); vault.claim(v, signature(v));
    }

    function testCapCannotBeDisabledAndDoesNotResetOnChange() public {
        ready(); vault.fundReserve(200 ether);
        vm.expectRevert(OmertaGameCustodyV2.InvalidConfiguration.selector); vault.setDailyCap(0);
        vm.expectRevert(OmertaGameCustodyV2.InvalidConfiguration.selector); vault.setDailyCap(1);
        OmertaGameCustodyV2.Voucher memory v = voucher(100 ether, 1);
        vault.claim(v, signature(v));
        v = voucher(1 ether, 2);
        vm.expectRevert(OmertaGameCustodyV2.DailyCapExceeded.selector); vault.claim(v, signature(v));
        vault.setDailyCap(101 ether);
        vault.claim(v, signature(v));
        assertEq(vault.claimedOnDay(block.timestamp / 1 days), 101 ether);
    }

    function testNewDayAllowsNewClaimsButNeverNonceReplay() public {
        ready(); vault.fundReserve(200 ether);
        OmertaGameCustodyV2.Voucher memory v = voucher(100 ether, 1);
        vault.claim(v, signature(v));
        vm.warp(block.timestamp + 1 days);
        v = voucher(100 ether, 1);
        vm.expectRevert(OmertaGameCustodyV2.InvalidVoucher.selector); vault.claim(v, signature(v));
        v.nonce = 2; vault.claim(v, signature(v));
        assertEq(token.balanceOf(address(vault)), 1e12);
    }

    function testTransferFailureRollsBackNonceAndCap() public {
        ready();
        OmertaGameCustodyV2.Voucher memory v = voucher(1 ether, 1);
        vm.expectRevert(); vault.claim(v, signature(v));
        assertFalse(vault.usedNonce(1));
        assertEq(vault.claimedOnDay(block.timestamp / 1 days), 0);
        assertEq(vault.cumulativeClaimed(), 0);
        vault.fundReserve(1 ether);
        vault.claim(v, signature(v));
    }

    function testMalformedExpiredUnsupportedAndUnregisteredVouchersFailClosed() public {
        ready(); vault.fundReserve(20 ether);
        OmertaGameCustodyV2.Voucher memory v = voucher(1 ether, 1);
        v.kind = 1;
        vm.expectRevert(OmertaGameCustodyV2.InvalidVoucher.selector); vault.claim(v, signature(v));
        v.kind = 0; v.gearId = 1;
        vm.expectRevert(OmertaGameCustodyV2.InvalidVoucher.selector); vault.claim(v, signature(v));
        v.gearId = 0; v.amount = 1;
        vm.expectRevert(OmertaGameCustodyV2.InvalidVoucher.selector); vault.claim(v, signature(v));
        v.amount = 1 ether; v.deadline = block.timestamp - 1;
        vm.expectRevert(OmertaGameCustodyV2.InvalidVoucher.selector); vault.claim(v, signature(v));
        v.deadline = block.timestamp + 1 days + 1;
        vm.expectRevert(OmertaGameCustodyV2.InvalidVoucher.selector); vault.claim(v, signature(v));
        v.deadline = block.timestamp + 1 days; v.to = address(0xDEAD);
        vm.expectRevert(); vault.claim(v, signature(v));
        assertFalse(vault.usedNonce(v.nonce));
        v.to = address(vault);
        vm.expectRevert(OmertaGameCustodyV2.InvalidVoucher.selector); vault.claim(v, signature(v));
        assertFalse(vault.usedNonce(v.nonce));
    }

    function testDomainRecipientAndSignerRotationCannotReplay() public {
        ready(); vault.fundReserve(10 ether);
        OmertaGameCustodyV2.Voucher memory v = voucher(1 ether, 1);
        bytes memory sig = signature(v);
        v.to = bob;
        vm.expectRevert(OmertaGameCustodyV2.InvalidVoucher.selector); vault.claim(v, sig);
        v.to = alice;
        vault.setSigner(bob);
        vm.expectRevert(OmertaGameCustodyV2.InvalidVoucher.selector); vault.claim(v, sig);
        vault.setSigner(signer);
        vm.chainId(initialChain + 1);
        vm.expectRevert(OmertaGameCustodyV2.InvalidVoucher.selector); vault.claim(v, sig);
        vm.chainId(initialChain); vault.claim(v, sig);
    }

    function testPauseBlocksDepositsFundingAndClaims() public {
        ready(); vault.pause();
        vm.expectRevert(); vault.fundReserve(1 ether);
        vm.prank(alice); vm.expectRevert(); vault.deposit(1 ether);
        OmertaGameCustodyV2.Voucher memory v = voucher(1 ether, 1);
        vm.expectRevert(); vault.claim(v, signature(v));
        vault.unpause(); vault.fundReserve(1 ether); vault.claim(v, signature(v));
    }

    function testFuzzDepositsAndClaimsConserveActualToken(uint64 raw, uint8 rounds) public {
        uint256 amount = bound(raw, 1, 100_000_000) * 1e12;
        uint256 count = bound(rounds, 1, 32);
        ready(); vault.setDailyCap(amount * count); vault.fundReserve(amount * count);
        for (uint256 i; i < count; ++i) {
            OmertaGameCustodyV2.Voucher memory v = voucher(amount, i);
            vault.claim(v, signature(v));
            vm.startPrank(alice, alice);
            token.approve(address(vault), amount); vault.deposit(amount);
            vm.stopPrank();
        }
        assertEq(vault.cumulativeFunded() - vault.cumulativeClaimed(), token.balanceOf(address(vault)));
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.totalSupply(), 100_000_000 ether);
    }
}
