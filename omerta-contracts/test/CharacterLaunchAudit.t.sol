// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Vm} from "forge-std/Vm.sol";
import {DynastyNFT} from "../src/DynastyNFT.sol";
import {OmertaFees} from "../src/OmertaFees.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @dev Independent EIP-712 oracle: tests do not ask the target contract which message to sign.
abstract contract CharacterAuditSigning is Test {
    uint256 internal constant KEY = 0xCAFE01;
    uint256 internal constant OTHER_KEY = 0xCAFE02;
    string internal constant BASE = "https://www.omerta.fun/v1/identity/";
    bytes32 internal constant DOMAIN_TYPE =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant VOUCHER_TYPE = keccak256("MintVoucher(address to,uint256 nonce,uint256 deadline)");

    function _digest(address target, uint256 chainId, DynastyNFT.MintVoucher memory v)
        internal pure returns (bytes32)
    {
        bytes32 domain = keccak256(abi.encode(DOMAIN_TYPE, keccak256("OmertaDynasty"), keccak256("1"), chainId, target));
        return keccak256(abi.encodePacked(hex"1901", domain, keccak256(abi.encode(VOUCHER_TYPE, v.to, v.nonce, v.deadline))));
    }

    function _sign(address target, uint256 chainId, DynastyNFT.MintVoucher memory v, uint256 key)
        internal pure returns (bytes memory)
    {
        (uint8 recovery, bytes32 r, bytes32 s) = vm.sign(key, _digest(target, chainId, v));
        return abi.encodePacked(r, s, recovery);
    }
}

contract CharacterAuditNftReceiver is IERC721Receiver {
    enum Mode { Accept, WrongSelector, RevertEmpty, RevertData, Reenter, Forward, ForwardThenReject }
    DynastyNFT public immutable nft;
    Mode public mode;
    address public destination;
    DynastyNFT.MintVoucher private nestedVoucher;
    bytes private nestedSignature;
    bool public callbackEntered;
    bool public nestedSucceeded;
    bytes4 public nestedError;
    uint256 public observedNextId;
    uint256 public observedDayCount;
    bool public observedUsedNonce;
    address public observedOwner;
    uint256 public outerNonce;
    error RejectPortrait();

    constructor(DynastyNFT nft_) { nft = nft_; }

    function configure(Mode mode_, address destination_, uint256 nonce_) external {
        mode = mode_;
        destination = destination_;
        outerNonce = nonce_;
    }

    function configureNested(DynastyNFT.MintVoucher calldata v, bytes calldata sig) external {
        nestedVoucher = v;
        nestedSignature = sig;
    }

    function onERC721Received(address, address, uint256 tokenId, bytes calldata) external returns (bytes4) {
        require(msg.sender == address(nft));
        callbackEntered = true;
        observedNextId = nft.nextId();
        observedDayCount = nft.mintedOnDay(block.timestamp / 1 days);
        observedUsedNonce = nft.usedNonce(outerNonce);
        observedOwner = nft.ownerOf(tokenId);
        if (mode == Mode.WrongSelector) return bytes4(0);
        if (mode == Mode.RevertEmpty) revert();
        if (mode == Mode.RevertData) revert RejectPortrait();
        if (mode == Mode.Reenter) {
            bytes memory reason;
            (nestedSucceeded, reason) = address(nft).call(abi.encodeCall(nft.claim, (nestedVoucher, nestedSignature)));
            if (reason.length >= 4) nestedError = bytes4(reason);
        }
        if (mode == Mode.Forward || mode == Mode.ForwardThenReject) {
            nft.transferFrom(address(this), destination, tokenId);
        }
        if (mode == Mode.ForwardThenReject) revert RejectPortrait();
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract CharacterAuditFeeReceiver {
    bool public rejects;
    uint256 public received;
    uint256 public callbacks;
    OmertaFees public feeTarget;
    uint256 public nestedValue;
    bytes public nestedCall;
    bool public triesNested;
    bool public nestedSucceeded;
    bytes4 public nestedError;

    function setReject(bool value) external { rejects = value; }
    function arm(OmertaFees target, bytes calldata data, uint256 value) external {
        feeTarget = target;
        nestedCall = data;
        nestedValue = value;
        triesNested = true;
    }
    function disarm() external { triesNested = false; }
    receive() external payable {
        if (rejects) revert("recipient rejected");
        received += msg.value;
        callbacks++;
        if (triesNested) {
            bytes memory reason;
            (nestedSucceeded, reason) = address(feeTarget).call{value: nestedValue}(nestedCall);
            if (reason.length >= 4) nestedError = bytes4(reason);
        }
    }
}

/// @dev Force native currency without invoking the receiver, including under EIP-6780.
contract CharacterAuditForceETH {
    constructor(address payable recipient) payable { selfdestruct(recipient); }
}

contract CharacterLaunchAuditTest is CharacterAuditSigning {
    DynastyNFT internal nft;
    OmertaFees internal fees;
    address internal safe = address(0x5001);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal attacker = address(0xBAD);
    CharacterAuditFeeReceiver internal dev;
    CharacterAuditFeeReceiver internal vig;

    function setUp() public {
        vm.chainId(46630);
        vm.warp(100 days + 123);
        dev = new CharacterAuditFeeReceiver();
        vig = new CharacterAuditFeeReceiver();
        nft = new DynastyNFT(safe, vm.addr(KEY), BASE, safe, 500, 10);
        fees = new OmertaFees(safe, payable(address(dev)), payable(address(vig)), 2500, 0.01 ether, 0.1 ether);
        vm.deal(alice, 100 ether);
        vm.deal(address(this), 100 ether);
    }

    function _voucher(address to, uint256 nonce, uint256 deadline) internal pure returns (DynastyNFT.MintVoucher memory) {
        return DynastyNFT.MintVoucher(to, nonce, deadline);
    }

    function _claim(DynastyNFT.MintVoucher memory v) internal returns (uint256) {
        return nft.claim(v, _sign(address(nft), block.chainid, v, KEY));
    }

    function _assertEmpty(uint256 nonce) internal view {
        assertEq(nft.nextId(), 1);
        assertEq(nft.mintedOnDay(block.timestamp / 1 days), 0);
        assertFalse(nft.usedNonce(nonce));
    }

    function test_domainIsIndependentOracleAndIERC5267Matches() public view {
        DynastyNFT.MintVoucher memory v = _voucher(alice, 0, block.timestamp);
        assertEq(nft.hashVoucher(v), _digest(address(nft), 46630, v));
        (bytes1 fields, string memory name, string memory version, uint256 chainId, address verifier, bytes32 salt,
            uint256[] memory extensions) = nft.eip712Domain();
        assertEq(fields, hex"0f");
        assertEq(name, "OmertaDynasty");
        assertEq(version, "1");
        assertEq(chainId, 46630);
        assertEq(verifier, address(nft));
        assertEq(salt, bytes32(0));
        assertEq(extensions.length, 0);
    }

    function test_crossContractAndChangedChainReplayRejected() public {
        DynastyNFT other = new DynastyNFT(safe, vm.addr(KEY), BASE, safe, 500, 10);
        DynastyNFT.MintVoucher memory v = _voucher(alice, 77, block.timestamp + 1 hours);
        bytes memory sig = _sign(address(nft), block.chainid, v, KEY);
        vm.expectRevert("DN: bad signature");
        other.claim(v, sig);
        vm.chainId(46631);
        vm.expectRevert("DN: bad signature");
        nft.claim(v, sig);
        _assertEmpty(77);
        vm.chainId(46630);
        nft.claim(v, sig);
        assertEq(nft.ownerOf(1), alice);
        assertEq(other.nextId(), 1);
    }

    function test_wrongDomainNameVersionAndTypeRejected() public {
        DynastyNFT.MintVoucher memory v = _voucher(alice, 78, block.timestamp + 1 hours);
        for (uint256 i; i < 3; i++) {
            bytes32 domain = keccak256(abi.encode(DOMAIN_TYPE,
                keccak256(bytes(i == 0 ? "OmertaDeed" : "OmertaDynasty")),
                keccak256(bytes(i == 1 ? "2" : "1")), block.chainid, address(nft)));
            bytes32 typeHash = i == 2 ? keccak256("OtherVoucher(address to,uint256 nonce,uint256 deadline)") : VOUCHER_TYPE;
            bytes32 digest = keccak256(abi.encodePacked(hex"1901", domain,
                keccak256(abi.encode(typeHash, v.to, v.nonce, v.deadline))));
            (uint8 recovery, bytes32 r, bytes32 s) = vm.sign(KEY, digest);
            vm.expectRevert("DN: bad signature");
            nft.claim(v, abi.encodePacked(r, s, recovery));
        }
        _assertEmpty(78);
    }

    function testFuzz_signedRecipientNonceAndDeadlineCannotBeAltered(uint128 nonce, uint32 ttl, uint8 field) public {
        uint256 life = bound(ttl, 1, 29 days);
        DynastyNFT.MintVoucher memory v = _voucher(alice, nonce, block.timestamp + life);
        bytes memory sig = _sign(address(nft), block.chainid, v, KEY);
        uint256 originalNonce = v.nonce;
        if (field % 3 == 0) v.to = attacker;
        else if (field % 3 == 1) v.nonce++;
        else v.deadline++;
        vm.expectRevert("DN: bad signature");
        nft.claim(v, sig);
        _assertEmpty(originalNonce);
        assertFalse(nft.usedNonce(v.nonce));
    }

    function test_nonCanonicalAndMalformedSignaturesRejectWithoutConsumingNonce() public {
        DynastyNFT.MintVoucher memory v = _voucher(alice, 79, block.timestamp + 1 hours);
        (uint8 recovery, bytes32 r, bytes32 s) = vm.sign(KEY, _digest(address(nft), block.chainid, v));
        bytes32 highS = bytes32(uint256(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141) - uint256(s));
        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureS.selector, highS));
        nft.claim(v, abi.encodePacked(r, highS, recovery == 27 ? uint8(28) : uint8(27)));
        vm.expectRevert(ECDSA.ECDSAInvalidSignature.selector);
        nft.claim(v, abi.encodePacked(r, s, uint8(0)));
        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureLength.selector, 0));
        nft.claim(v, "");
        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureLength.selector, 64));
        nft.claim(v, abi.encodePacked(r, s));
        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureLength.selector, 66));
        nft.claim(v, abi.encodePacked(r, s, recovery, uint8(1)));
        vm.expectRevert(ECDSA.ECDSAInvalidSignature.selector);
        nft.claim(v, abi.encodePacked(bytes32(0), bytes32(0), uint8(27)));
        _assertEmpty(79);
        nft.claim(v, abi.encodePacked(r, s, recovery));
        assertEq(nft.ownerOf(1), alice);
    }

    function test_deadlineInclusiveAndMaximumTtlBoundaries() public {
        _claim(_voucher(alice, 1, block.timestamp));
        _claim(_voucher(alice, 2, block.timestamp + 30 days));
        DynastyNFT.MintVoucher memory expired = _voucher(alice, 3, block.timestamp - 1);
        bytes memory sig = _sign(address(nft), block.chainid, expired, KEY);
        vm.expectRevert("DN: expired");
        nft.claim(expired, sig);
        DynastyNFT.MintVoucher memory future = _voucher(alice, 4, block.timestamp + 30 days + 1);
        sig = _sign(address(nft), block.chainid, future, KEY);
        vm.expectRevert("DN: deadline too far");
        nft.claim(future, sig);
        assertFalse(nft.usedNonce(3));
        assertFalse(nft.usedNonce(4));
        assertEq(nft.nextId(), 3);
    }

    function test_ttlIsMeasuredAtClaimNotAtSigning() public {
        // Documents a limit, not a theft claim: the voucher format contains no issuance time.
        DynastyNFT.MintVoucher memory v = _voucher(alice, 80, block.timestamp + 31 days);
        bytes memory sig = _sign(address(nft), block.chainid, v, KEY);
        vm.expectRevert("DN: deadline too far");
        nft.claim(v, sig);
        vm.warp(block.timestamp + 1 days);
        nft.claim(v, sig);
        assertEq(nft.ownerOf(1), alice);
    }

    function test_relayerCannotRedirectAndNonceSurvivesRotationAndTransfer() public {
        DynastyNFT.MintVoucher memory v = _voucher(alice, type(uint256).max, block.timestamp + 1 hours);
        bytes memory sig = _sign(address(nft), block.chainid, v, KEY);
        vm.prank(attacker);
        nft.claim(v, sig);
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.balanceOf(attacker), 0);
        vm.prank(alice);
        nft.transferFrom(alice, bob, 1);
        vm.startPrank(safe);
        nft.setSigner(vm.addr(OTHER_KEY));
        nft.setSigner(vm.addr(KEY));
        vm.stopPrank();
        vm.expectRevert("DN: replay");
        nft.claim(v, sig);
        assertEq(nft.ownerOf(1), bob);
        assertEq(nft.nextId(), 2);
    }

    function test_signerRotationInvalidatesUnspentSignatures() public {
        DynastyNFT.MintVoucher memory v = _voucher(alice, 81, block.timestamp + 1 hours);
        bytes memory oldSig = _sign(address(nft), block.chainid, v, KEY);
        vm.prank(safe);
        nft.setSigner(vm.addr(OTHER_KEY));
        vm.expectRevert("DN: bad signature");
        nft.claim(v, oldSig);
        _assertEmpty(81);
        nft.claim(v, _sign(address(nft), block.chainid, v, OTHER_KEY));
        assertEq(nft.ownerOf(1), alice);
    }

    function test_zeroAndMaximumNoncesAreIndependentReplayKeys() public {
        _claim(_voucher(alice, 0, block.timestamp));
        _claim(_voucher(bob, type(uint256).max, block.timestamp));
        assertTrue(nft.usedNonce(0));
        assertTrue(nft.usedNonce(type(uint256).max));
        assertEq(nft.nextId(), 3);
    }

    function test_dailyBoundaryAllowsTwoDailyBudgetsButNeverMoreWithinEitherDay() public {
        vm.prank(safe);
        nft.setDailyMintCap(1);
        uint256 day = block.timestamp / 1 days;
        vm.warp((day + 1) * 1 days - 1);
        _claim(_voucher(alice, 1, block.timestamp + 2 days));
        DynastyNFT.MintVoucher memory second = _voucher(bob, 2, block.timestamp + 2 days);
        bytes memory sig = _sign(address(nft), block.chainid, second, KEY);
        vm.expectRevert("DN: daily cap");
        nft.claim(second, sig);
        assertFalse(nft.usedNonce(2));
        vm.warp(block.timestamp + 1);
        nft.claim(second, sig);
        assertEq(nft.mintedOnDay(day), 1);
        assertEq(nft.mintedOnDay(day + 1), 1);
        assertEq(nft.nextId(), 3);
    }

    function test_loweredCapDoesNotEraseDailyUsageAndZeroMeansUnlimited() public {
        _claim(_voucher(alice, 1, block.timestamp));
        _claim(_voucher(alice, 2, block.timestamp));
        vm.prank(safe);
        nft.setDailyMintCap(1);
        DynastyNFT.MintVoucher memory v = _voucher(alice, 3, block.timestamp);
        bytes memory sig = _sign(address(nft), block.chainid, v, KEY);
        vm.expectRevert("DN: daily cap");
        nft.claim(v, sig);
        assertFalse(nft.usedNonce(3));
        vm.prank(safe);
        nft.setDailyMintCap(0);
        nft.claim(v, sig);
        assertEq(nft.mintedOnDay(block.timestamp / 1 days), 3);
    }

    function test_receiverReentryCannotConsumeFreshVoucherOrExceedCap() public {
        CharacterAuditNftReceiver receiver = new CharacterAuditNftReceiver(nft);
        receiver.configure(CharacterAuditNftReceiver.Mode.Reenter, bob, 1);
        DynastyNFT.MintVoucher memory nested = _voucher(bob, 2, block.timestamp + 1 hours);
        receiver.configureNested(nested, _sign(address(nft), block.chainid, nested, KEY));
        _claim(_voucher(address(receiver), 1, block.timestamp + 1 hours));
        assertTrue(receiver.callbackEntered());
        assertFalse(receiver.nestedSucceeded());
        assertEq(receiver.nestedError(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(receiver.observedNextId(), 2);
        assertEq(receiver.observedDayCount(), 1);
        assertTrue(receiver.observedUsedNonce());
        assertEq(receiver.observedOwner(), address(receiver));
        assertFalse(nft.usedNonce(2));
        assertEq(nft.balanceOf(bob), 0);
        _claim(nested);
        assertEq(nft.balanceOf(bob), 1);
    }

    function testFuzz_rejectingMintReceiverRollsBackNonceSupplyAndTransfers(uint8 variant) public {
        CharacterAuditNftReceiver receiver = new CharacterAuditNftReceiver(nft);
        CharacterAuditNftReceiver.Mode[4] memory modes = [
            CharacterAuditNftReceiver.Mode.WrongSelector, CharacterAuditNftReceiver.Mode.RevertEmpty,
            CharacterAuditNftReceiver.Mode.RevertData, CharacterAuditNftReceiver.Mode.ForwardThenReject
        ];
        receiver.configure(modes[variant % 4], bob, 1);
        DynastyNFT.MintVoucher memory v = _voucher(address(receiver), 1, block.timestamp + 1 hours);
        bytes memory sig = _sign(address(nft), block.chainid, v, KEY);
        (bool ok,) = address(nft).call(abi.encodeCall(nft.claim, (v, sig)));
        assertFalse(ok);
        _assertEmpty(1);
        assertEq(nft.balanceOf(bob), 0);
        assertEq(nft.balanceOf(address(receiver)), 0);
        assertFalse(receiver.callbackEntered());
        receiver.configure(CharacterAuditNftReceiver.Mode.Accept, bob, 1);
        nft.claim(v, sig);
        assertEq(nft.ownerOf(1), address(receiver));
    }

    function test_callbackMayTransferBeforeCustomMintedEventWithoutCreatingExtraToken() public {
        CharacterAuditNftReceiver receiver = new CharacterAuditNftReceiver(nft);
        receiver.configure(CharacterAuditNftReceiver.Mode.Forward, bob, 1);
        vm.recordLogs();
        _claim(_voucher(address(receiver), 1, block.timestamp + 1 hours));
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 3);
        assertEq(logs[0].topics[0], keccak256("Transfer(address,address,uint256)"));
        assertEq(logs[1].topics[0], keccak256("Transfer(address,address,uint256)"));
        assertEq(logs[2].topics[0], keccak256("Minted(uint256,address,uint256)"));
        assertEq(address(uint160(uint256(logs[2].topics[2]))), address(receiver));
        assertEq(nft.ownerOf(1), bob);
        assertEq(nft.balanceOf(address(receiver)), 0);
        assertEq(nft.balanceOf(bob), 1);
        assertEq(nft.nextId(), 2);
    }

    function test_approvalCannotEscalateAndOldApprovalDoesNotTravel() public {
        _claim(_voucher(alice, 1, block.timestamp));
        vm.prank(alice);
        nft.approve(attacker, 1);
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InvalidApprover.selector, attacker));
        nft.approve(bob, 1);
        vm.prank(attacker);
        nft.transferFrom(alice, bob, 1);
        assertEq(nft.getApproved(1), address(0));
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InsufficientApproval.selector, attacker, 1));
        nft.transferFrom(bob, attacker, 1);
        assertEq(nft.ownerOf(1), bob);
    }

    function test_blanketApprovalRevokeSelfTransferAndWrongFromRemainAtomic() public {
        _claim(_voucher(alice, 1, block.timestamp));
        vm.prank(alice);
        nft.setApprovalForAll(attacker, true);
        assertTrue(nft.isApprovedForAll(alice, attacker));
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721IncorrectOwner.selector, bob, 1, alice));
        nft.transferFrom(bob, attacker, 1);
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.balanceOf(alice), 1);
        vm.startPrank(alice);
        nft.setApprovalForAll(attacker, false);
        nft.approve(bob, 1);
        nft.transferFrom(alice, alice, 1);
        vm.stopPrank();
        assertEq(nft.balanceOf(alice), 1);
        assertEq(nft.getApproved(1), address(0));
        assertFalse(nft.isApprovedForAll(alice, attacker));
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InsufficientApproval.selector, attacker, 1));
        nft.transferFrom(alice, attacker, 1);
    }

    function test_rejectingSafeTransferRestoresOwnerBalancesAndApproval() public {
        _claim(_voucher(alice, 1, block.timestamp));
        CharacterAuditNftReceiver receiver = new CharacterAuditNftReceiver(nft);
        receiver.configure(CharacterAuditNftReceiver.Mode.RevertData, bob, 1);
        vm.prank(alice);
        nft.approve(attacker, 1);
        vm.prank(attacker);
        vm.expectRevert(CharacterAuditNftReceiver.RejectPortrait.selector);
        nft.safeTransferFrom(alice, address(receiver), 1, "audit");
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.getApproved(1), attacker);
        assertEq(nft.balanceOf(alice), 1);
        assertEq(nft.balanceOf(address(receiver)), 0);
    }

    function test_pauseStopsOnlyMintAndUnpauseReusesUntouchedVoucher() public {
        _claim(_voucher(alice, 1, block.timestamp));
        DynastyNFT.MintVoucher memory v = _voucher(bob, 2, block.timestamp + 1 hours);
        bytes memory sig = _sign(address(nft), block.chainid, v, KEY);
        vm.prank(safe);
        nft.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        nft.claim(v, sig);
        assertFalse(nft.usedNonce(2));
        vm.prank(alice);
        nft.approve(attacker, 1);
        vm.prank(attacker);
        nft.safeTransferFrom(alice, bob, 1);
        assertEq(nft.ownerOf(1), bob);
        vm.prank(safe);
        nft.unpause();
        nft.claim(v, sig);
        assertEq(nft.balanceOf(bob), 2);
    }

    function test_nftAndFeeOwnershipRequireAcceptanceAndCancelledNomineeHasNoPower() public {
        vm.startPrank(safe);
        nft.transferOwnership(alice);
        fees.transferOwnership(alice);
        vm.stopPrank();
        assertEq(nft.owner(), safe);
        assertEq(fees.owner(), safe);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        nft.setSigner(alice);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, bob));
        fees.acceptOwnership();
        vm.startPrank(safe);
        nft.transferOwnership(address(0));
        fees.transferOwnership(address(0));
        vm.stopPrank();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        nft.acceptOwnership();
        vm.startPrank(safe);
        nft.transferOwnership(bob);
        fees.transferOwnership(bob);
        vm.stopPrank();
        vm.startPrank(bob);
        nft.acceptOwnership();
        fees.acceptOwnership();
        vm.stopPrank();
        assertEq(nft.owner(), bob);
        assertEq(fees.owner(), bob);
        assertEq(nft.pendingOwner(), address(0));
        assertEq(fees.pendingOwner(), address(0));
        vm.prank(safe);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, safe));
        fees.setFees(1, 1);
    }

    function test_allCustomAdministrativeSelectorsRejectUnprivilegedActor() public {
        bytes[] memory nftCalls = new bytes[](8);
        nftCalls[0] = abi.encodeCall(nft.setSigner, (attacker));
        nftCalls[1] = abi.encodeCall(nft.setDailyMintCap, (0));
        nftCalls[2] = abi.encodeCall(nft.setBaseUri, ("evil:"));
        nftCalls[3] = abi.encodeCall(nft.setDefaultRoyalty, (attacker, uint96(10000)));
        nftCalls[4] = abi.encodeCall(nft.pause, ());
        nftCalls[5] = abi.encodeCall(nft.unpause, ());
        nftCalls[6] = abi.encodeCall(nft.transferOwnership, (attacker));
        nftCalls[7] = abi.encodeCall(nft.renounceOwnership, ());
        bytes[] memory feeCalls = new bytes[](8);
        feeCalls[0] = abi.encodeCall(fees.setFeeRecipient, (payable(attacker)));
        feeCalls[1] = abi.encodeCall(fees.setVigRecipient, (payable(attacker)));
        feeCalls[2] = abi.encodeCall(fees.setFees, (1, 1));
        feeCalls[3] = abi.encodeCall(fees.setRerollFee, (1));
        feeCalls[4] = abi.encodeCall(fees.setPackagePrice, (0, 1));
        feeCalls[5] = abi.encodeCall(fees.sweep, ());
        feeCalls[6] = abi.encodeCall(fees.transferOwnership, (attacker));
        feeCalls[7] = abi.encodeCall(fees.renounceOwnership, ());
        for (uint256 i; i < nftCalls.length; i++) {
            vm.prank(attacker);
            (bool ok, bytes memory reason) = address(nft).call(nftCalls[i]);
            assertFalse(ok);
            assertEq(reason, abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
            vm.prank(attacker);
            (ok, reason) = address(fees).call(feeCalls[i]);
            assertFalse(ok);
            assertEq(reason, abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        }
        assertEq(nft.owner(), safe);
        assertEq(fees.owner(), safe);
    }

    function test_ownerRenunciationIsIrreversibleAndClearsPendingOwner() public {
        // Explicit trusted-governance risk, not an unauthorized attacker finding.
        vm.startPrank(safe);
        nft.transferOwnership(alice);
        fees.transferOwnership(alice);
        nft.renounceOwnership();
        fees.renounceOwnership();
        vm.stopPrank();
        assertEq(nft.owner(), address(0));
        assertEq(fees.owner(), address(0));
        assertEq(nft.pendingOwner(), address(0));
        assertEq(fees.pendingOwner(), address(0));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        nft.acceptOwnership();
        _claim(_voucher(alice, 1, block.timestamp));
        vm.prank(alice);
        fees.payMintFee{value: 0.01 ether}();
        assertEq(fees.nonce(), 1);
    }

    function test_interfacesMetadataAndRoyaltyBoundaries() public {
        assertTrue(nft.supportsInterface(0x01ffc9a7));
        assertTrue(nft.supportsInterface(0x80ac58cd));
        assertTrue(nft.supportsInterface(0x5b5e139f));
        assertTrue(nft.supportsInterface(0x2a55205a));
        assertFalse(nft.supportsInterface(0xffffffff));
        assertFalse(nft.supportsInterface(0x780e9d63)); // Enumerable is not advertised.
        assertEq(nft.name(), "OMERTA Dynasty");
        assertEq(nft.symbol(), "OMERTA");
        _claim(_voucher(alice, 1, block.timestamp));
        assertEq(nft.tokenURI(1), string.concat(BASE, "1"));
        vm.prank(safe);
        nft.setBaseUri("ipfs://new/");
        assertEq(nft.tokenURI(1), "ipfs://new/1");
        vm.prank(safe);
        nft.setDefaultRoyalty(bob, 10000);
        (address recipient, uint256 amount) = nft.royaltyInfo(1, 37);
        assertEq(recipient, bob);
        assertEq(amount, 37);
        vm.prank(safe);
        nft.setDefaultRoyalty(bob, 0);
        (, amount) = nft.royaltyInfo(1, type(uint256).max);
        assertEq(amount, 0);
        vm.prank(safe);
        vm.expectRevert();
        nft.setDefaultRoyalty(bob, 10001);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 2));
        nft.tokenURI(2);
    }

    function testFuzz_nonMintFeeConservesValueAndBoundsRoundingAcrossAllBps(
        uint96 priceSeed, uint16 bpsSeed, uint8 kindSeed
    ) public {
        uint256 amount = bound(priceSeed, 1, 100 ether);
        uint256 bps = bound(bpsSeed, 0, 10000);
        OmertaFees target = new OmertaFees(safe, payable(address(dev)), payable(address(vig)), bps, amount, amount);
        vm.prank(safe);
        target.setPackagePrice(7, amount);
        vm.prank(alice);
        if (kindSeed % 3 == 0) target.payRespawnFee{value: amount}();
        else if (kindSeed % 3 == 1) target.payRerollFee{value: amount}();
        else target.payForPackage{value: amount}(7);
        assertEq(dev.received() + vig.received(), amount);
        assertEq(address(target).balance, 0);
        assertEq(target.nonce(), 1);
        assertLe(vig.received() * 10000, amount * bps);
        assertLt(amount * bps, (vig.received() + 1) * 10000);
        assertEq(alice.balance, 100 ether - amount);
    }

    function testFuzz_mintAlwaysPaysAllDevAcrossAllVigBps(uint96 priceSeed, uint16 bpsSeed) public {
        uint256 amount = bound(priceSeed, 1, 100 ether);
        uint256 bps = bound(bpsSeed, 0, 10000);
        OmertaFees target = new OmertaFees(safe, payable(address(dev)), payable(address(vig)), bps, amount, amount);
        vig.setReject(true); // A nonzero configured Vig share cannot obstruct character creation.
        vm.expectEmit(true, false, false, true, address(target));
        emit OmertaFees.FeeSplit(1, amount, 0);
        vm.expectEmit(true, true, false, true, address(target));
        emit OmertaFees.MintFeePaid(alice, 1, amount);
        vm.prank(alice);
        target.payMintFee{value: amount}();
        assertEq(target.mintDevBps(), 10000);
        assertEq(dev.received(), amount);
        assertEq(dev.callbacks(), 1);
        assertEq(vig.received(), 0);
        assertEq(vig.callbacks(), 0);
        assertEq(address(target).balance, 0);
        assertEq(target.nonce(), 1);
        assertEq(alice.balance, 100 ether - amount);
    }

    function test_mintOddWeiAllDevEvenWhenAllNonMintFeesGoToVig() public {
        OmertaFees target = new OmertaFees(safe, payable(address(dev)), payable(address(vig)), 10000, 101, 103);
        vm.prank(safe);
        target.setPackagePrice(7, 107);
        vig.setReject(true);
        vm.prank(alice);
        target.payMintFee{value: 101}();
        assertEq(dev.received(), 101);
        assertEq(vig.callbacks(), 0);
        vig.setReject(false);
        vm.startPrank(alice);
        target.payRespawnFee{value: 103}();
        target.payRerollFee{value: 101}();
        target.payForPackage{value: 107}(7);
        vm.stopPrank();
        assertEq(dev.received(), 101);
        assertEq(dev.callbacks(), 1);
        assertEq(vig.received(), 311);
        assertEq(vig.callbacks(), 3);
        assertEq(address(target).balance, 0);
        assertEq(target.nonce(), 4);
    }

    function test_mintRejectingDevRevertsAtomicallyEvenAtFullVigBps() public {
        OmertaFees target = new OmertaFees(safe, payable(address(dev)), payable(address(vig)), 10000, 101, 103);
        dev.setReject(true);
        vm.prank(alice);
        vm.expectRevert(OmertaFees.ForwardFailed.selector);
        target.payMintFee{value: 101}();
        assertEq(target.nonce(), 0);
        assertEq(dev.received(), 0);
        assertEq(dev.callbacks(), 0);
        assertEq(vig.received(), 0);
        assertEq(vig.callbacks(), 0);
        assertEq(address(target).balance, 0);
        assertEq(alice.balance, 100 ether);
        dev.setReject(false);
        vm.prank(alice);
        target.payMintFee{value: 101}();
        assertEq(target.nonce(), 1);
        assertEq(dev.received(), 101);
        assertEq(alice.balance, 100 ether - 101);
    }

    function test_bothFeeLegsAndNonceRevertIfSecondRecipientRejects() public {
        dev.setReject(true); // Vig is paid first; its apparent receipt must unwind too.
        vm.prank(alice);
        vm.expectRevert(OmertaFees.ForwardFailed.selector);
        fees.payRespawnFee{value: 0.1 ether}();
        assertEq(vig.received(), 0);
        assertEq(vig.callbacks(), 0);
        assertEq(address(vig).balance, 0);
        assertEq(address(dev).balance, 0);
        assertEq(fees.nonce(), 0);
        assertEq(alice.balance, 100 ether);
        dev.setReject(false);
        vm.prank(alice);
        fees.payRespawnFee{value: 0.1 ether}();
        assertEq(fees.nonce(), 1);
        assertEq(vig.received() + dev.received(), 0.1 ether);
    }

    function test_zeroFeeShareDoesNotCallRejectingRecipient() public {
        vig.setReject(true);
        OmertaFees target = new OmertaFees(safe, payable(address(dev)), payable(address(vig)), 0, 1, 1);
        vm.prank(alice);
        target.payRespawnFee{value: 1}();
        assertEq(dev.received(), 1);
        assertEq(vig.callbacks(), 0);
        vig.setReject(false);
        dev.setReject(true);
        target = new OmertaFees(safe, payable(address(dev)), payable(address(vig)), 10000, 1, 1);
        vm.prank(alice);
        target.payRespawnFee{value: 1}();
        assertEq(vig.received(), 1);
        assertEq(dev.callbacks(), 1);
    }

    function test_sameRecipientReceivesExactlyOneGrossPayment() public {
        OmertaFees target = new OmertaFees(safe, payable(address(dev)), payable(address(dev)), 2500, 0.01 ether, 1);
        vm.prank(alice);
        target.payMintFee{value: 0.01 ether}();
        assertEq(dev.received(), 0.01 ether);
        assertEq(dev.callbacks(), 1); // Mint pays once, even when DEV and Vig share an address.
        assertEq(target.nonce(), 1);
    }

    function test_allFeePaymentEntryPointsBlockCrossFunctionReentry() public {
        vm.prank(safe);
        fees.setPackagePrice(7, 0.01 ether);
        bytes[] memory calls = new bytes[](4);
        calls[0] = abi.encodeCall(fees.payMintFee, ());
        calls[1] = abi.encodeCall(fees.payRespawnFee, ());
        calls[2] = abi.encodeCall(fees.payRerollFee, ());
        calls[3] = abi.encodeCall(fees.payForPackage, (7));
        uint256 paid;
        for (uint256 outer; outer < calls.length; outer++) {
            CharacterAuditFeeReceiver recipient = outer == 0 ? dev : vig;
            dev.disarm();
            vig.disarm();
            for (uint256 nested; nested < calls.length; nested++) {
                vm.deal(address(recipient), 1 ether);
                recipient.arm(fees, calls[nested], nested == 1 ? 0.1 ether : 0.01 ether);
                uint256 price = outer == 1 ? 0.1 ether : 0.01 ether;
                vm.prank(alice);
                (bool ok,) = address(fees).call{value: price}(calls[outer]);
                assertTrue(ok);
                paid += price;
                assertFalse(recipient.nestedSucceeded());
                assertEq(recipient.nestedError(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
                assertEq(fees.nonce(), outer * calls.length + nested + 1);
            }
        }
        assertEq(dev.received() + vig.received(), paid);
    }

    function test_nativeTransfersCannotForgeFeeEventsAndForcedBalanceSweepsOnlyToOwner() public {
        vm.prank(alice);
        (bool direct,) = address(fees).call{value: 1}("");
        assertFalse(direct);
        assertEq(fees.nonce(), 0);
        new CharacterAuditForceETH{value: 2 ether}(payable(address(fees)));
        assertEq(address(fees).balance, 2 ether);
        vm.prank(alice);
        fees.payMintFee{value: 0.01 ether}();
        assertEq(address(fees).balance, 2 ether);
        uint256 oldOwnerBalance = safe.balance;
        vm.prank(safe);
        fees.sweep();
        assertEq(safe.balance, oldOwnerBalance + 2 ether);
        assertEq(address(fees).balance, 0);
        assertEq(fees.nonce(), 1);
        assertEq(dev.received() + vig.received(), 0.01 ether);
    }

    function test_retiredSkuWrongPaymentsAndUnconfiguredSelectorsDoNotMoveFunds() public {
        vm.prank(safe);
        fees.setPackagePrice(type(uint256).max, 17);
        vm.prank(alice);
        fees.payForPackage{value: 17}(type(uint256).max);
        vm.prank(safe);
        fees.setPackagePrice(type(uint256).max, 0);
        vm.prank(alice);
        vm.expectRevert(OmertaFees.ZeroFee.selector);
        fees.payForPackage{value: 17}(type(uint256).max);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(OmertaFees.WrongFee.selector, 0, 0.01 ether));
        fees.payMintFee();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(OmertaFees.WrongFee.selector, 0.01 ether + 1, 0.01 ether));
        fees.payMintFee{value: 0.01 ether + 1}();
        (bool ok,) = address(nft).call(abi.encodeWithSignature("mint(address)", attacker));
        assertFalse(ok);
        (ok,) = address(nft).call(abi.encodeWithSignature("initialize(address)", attacker));
        assertFalse(ok);
        assertEq(fees.nonce(), 1);
        assertEq(dev.received() + vig.received(), 17);
        assertEq(nft.nextId(), 1);
    }
}

/// @dev Stateful model uses its own owners, nonce set, success counts and day buckets.
contract CharacterAuditNftHandler is CharacterAuditSigning {
    DynastyNFT public nft;
    address[4] public actors = [address(0x1101), address(0x1102), address(0x1103), address(0x1104)];
    uint256 public signingKey = KEY;
    uint256 public modelCap = 3;
    bool public modelPaused;
    uint256 public successfulMints;
    uint256 public attemptedMints;
    mapping(uint256 => bool) public nonceUsed;
    mapping(uint256 => address) public tokenOwner;
    mapping(uint256 => uint256) public dayMints;
    uint256[] public usedDays;

    constructor() { nft = new DynastyNFT(address(this), vm.addr(KEY), BASE, address(this), 500, modelCap); }

    function claim(uint256 nonceSeed, uint256 actorSeed, uint256 modeSeed) public {
        attemptedMints++;
        uint256 nonce = nonceSeed % 64;
        uint256 mode = modeSeed % 7;
        uint256 deadline = block.timestamp + 1 hours;
        if (mode == 1) deadline = block.timestamp;
        if (mode == 2) deadline = block.timestamp + 30 days;
        if (mode == 3) deadline = block.timestamp - 1;
        if (mode == 4) deadline = block.timestamp + 30 days + 1;
        DynastyNFT.MintVoucher memory v = DynastyNFT.MintVoucher(actors[actorSeed % 4], nonce, deadline);
        bytes memory sig = _sign(address(nft), block.chainid, v, mode == 5 ? 0xBAD001 : signingKey);
        if (mode == 6) v.to = address(0);
        uint256 day = block.timestamp / 1 days;
        bool expected = !modelPaused && !nonceUsed[nonce] && mode != 3 && mode != 4 && mode != 5 && mode != 6
            && (modelCap == 0 || dayMints[day] < modelCap);
        (bool ok, bytes memory result) = address(nft).call(abi.encodeCall(nft.claim, (v, sig)));
        assertEq(ok, expected, "mint outcome must match independent authorization model");
        if (!ok) return;
        successfulMints++;
        assertEq(abi.decode(result, (uint256)), successfulMints);
        nonceUsed[nonce] = true;
        tokenOwner[successfulMints] = v.to;
        if (dayMints[day] == 0) usedDays.push(day);
        dayMints[day]++;
    }

    function changeTime(uint32 jump) public { vm.warp(block.timestamp + bound(jump, 0, 2 days)); }
    function changeCap(uint8 cap) public { modelCap = cap % 8; nft.setDailyMintCap(modelCap); }
    function rotateSigner() public {
        signingKey = signingKey == KEY ? OTHER_KEY : KEY;
        nft.setSigner(vm.addr(signingKey));
    }
    function togglePause() public {
        if (modelPaused) nft.unpause(); else nft.pause();
        modelPaused = !modelPaused;
    }

    function transfer(uint256 tokenSeed, uint256 actorSeed, uint256 kindSeed) public {
        if (successfulMints == 0) return;
        uint256 id = tokenSeed % successfulMints + 1;
        address from = tokenOwner[id];
        address to = actors[actorSeed % 4];
        uint256 kind = kindSeed % 4;
        if (kind == 0) {
            vm.prank(from);
            nft.transferFrom(from, to, id);
        } else if (kind == 1) {
            vm.prank(from);
            nft.approve(address(this), id);
            nft.safeTransferFrom(from, to, id);
        } else if (kind == 2) {
            vm.prank(from);
            nft.setApprovalForAll(address(this), true);
            nft.safeTransferFrom(from, to, id, "stateful");
            vm.prank(from);
            nft.setApprovalForAll(address(this), false);
        } else {
            vm.prank(address(0xBAD001));
            (bool ok,) = address(nft).call(abi.encodeCall(nft.transferFrom, (from, to, id)));
            assertFalse(ok, "unapproved actor must not transfer");
            return;
        }
        tokenOwner[id] = to;
        assertEq(nft.getApproved(id), address(0));
    }

    function assertModel() external view {
        assertEq(nft.nextId(), successfulMints + 1);
        assertEq(nft.paused(), modelPaused);
        assertEq(nft.dailyMintCap(), modelCap);
        assertEq(nft.signer(), vm.addr(signingKey));
        uint256 totalBalances;
        for (uint256 i; i < actors.length; i++) {
            uint256 expectedBalance;
            for (uint256 id = 1; id <= successfulMints; id++) if (tokenOwner[id] == actors[i]) expectedBalance++;
            assertEq(nft.balanceOf(actors[i]), expectedBalance);
            totalBalances += expectedBalance;
        }
        assertEq(totalBalances, successfulMints);
        for (uint256 id = 1; id <= successfulMints; id++) assertEq(nft.ownerOf(id), tokenOwner[id]);
        for (uint256 nonce; nonce < 64; nonce++) assertEq(nft.usedNonce(nonce), nonceUsed[nonce]);
        uint256 totalDayMints;
        for (uint256 i; i < usedDays.length; i++) {
            assertEq(nft.mintedOnDay(usedDays[i]), dayMints[usedDays[i]]);
            totalDayMints += dayMints[usedDays[i]];
        }
        assertEq(totalDayMints, successfulMints);
    }
}

contract CharacterAuditFeesHandler is Test {
    OmertaFees public fees;
    CharacterAuditFeeReceiver[3] public recipients;
    uint256[3] public expectedReceipts;
    uint256 public devIndex;
    uint256 public vigIndex = 1;
    uint256 public successfulPayments;
    uint256 public attemptedPayments;
    uint256 public grossPaid;
    uint256 public forcedTotal;
    uint256 public sweptTotal;
    address private constant PAYER = address(0x2201);

    constructor() {
        for (uint256 i; i < 3; i++) recipients[i] = new CharacterAuditFeeReceiver();
        fees = new OmertaFees(address(this), payable(address(recipients[0])), payable(address(recipients[1])), 2500, 101, 1013);
        fees.setPackagePrice(0, 17);
    }
    receive() external payable {}

    function changePrices(uint96 price, uint8 sku) public {
        uint256 value = bound(price, 1, 1 ether);
        fees.setFees(value, value + 1);
        fees.setRerollFee(value + 2);
        fees.setPackagePrice(sku % 4, price % 3 == 0 ? 0 : value + 3);
    }
    function rotateRecipients(uint8 first, uint8 second) public {
        devIndex = first % 3;
        vigIndex = second % 3;
        fees.setFeeRecipient(payable(address(recipients[devIndex])));
        fees.setVigRecipient(payable(address(recipients[vigIndex])));
    }
    function rejectRecipient(uint8 index, bool rejected) public { recipients[index % 3].setReject(rejected); }

    function payment(uint8 kindSeed, uint8 skuSeed, uint8 amountMode) public {
        attemptedPayments++;
        uint256 kind = kindSeed % 4;
        uint256 sku = skuSeed % 4;
        uint256 price = kind == 0 ? fees.mintFee() : kind == 1 ? fees.respawnFee() : kind == 2 ? fees.rerollFee() : fees.packagePrice(sku);
        uint256 amount = amountMode % 3 == 0 ? price : amountMode % 3 == 1 ? price + 1 : price == 0 ? 0 : price - 1;
        vm.deal(PAYER, 10 ether);
        uint256 oldRecipientTotal = _recipientTotal();
        uint256 oldCustody = address(fees).balance;
        uint256 vigAmount = kind == 0 ? 0 : amount / 4;
        bool expected = price > 0 && amount == price
            && (vigAmount == 0 || !recipients[vigIndex].rejects())
            && (amount == vigAmount || !recipients[devIndex].rejects());
        bytes memory data = kind == 0 ? abi.encodeCall(fees.payMintFee, ())
            : kind == 1 ? abi.encodeCall(fees.payRespawnFee, ())
            : kind == 2 ? abi.encodeCall(fees.payRerollFee, ()) : abi.encodeCall(fees.payForPackage, (sku));
        vm.prank(PAYER);
        (bool ok,) = address(fees).call{value: amount}(data);
        assertEq(ok, expected, "fee outcome must match price/recipient conditions");
        assertEq(address(fees).balance, oldCustody, "payment must not change preexisting forced balance");
        if (ok) {
            successfulPayments++;
            grossPaid += amount;
            expectedReceipts[devIndex] += amount - vigAmount;
            expectedReceipts[vigIndex] += vigAmount;
            assertEq(_recipientTotal(), oldRecipientTotal + amount);
            assertEq(PAYER.balance, 10 ether - amount);
        } else {
            assertEq(_recipientTotal(), oldRecipientTotal);
            assertEq(PAYER.balance, 10 ether);
        }
        assertEq(fees.nonce(), successfulPayments);
    }

    function forceAndMaybeSweep(uint96 amountSeed, bool sweepNow) public {
        uint256 amount = bound(amountSeed, 1, 1 ether);
        vm.deal(address(this), amount);
        new CharacterAuditForceETH{value: amount}(payable(address(fees)));
        forcedTotal += amount;
        if (sweepNow) {
            sweptTotal += address(fees).balance;
            fees.sweep();
        }
    }

    function _recipientTotal() internal view returns (uint256 total) {
        for (uint256 i; i < 3; i++) total += address(recipients[i]).balance;
    }

    function assertModel() external view {
        assertEq(fees.nonce(), successfulPayments);
        assertEq(_recipientTotal(), grossPaid);
        assertEq(address(fees).balance + sweptTotal, forcedTotal);
        assertEq(fees.owner(), address(this));
        assertEq(fees.feeRecipient(), address(recipients[devIndex]));
        assertEq(fees.vigRecipient(), address(recipients[vigIndex]));
        assertEq(fees.mintDevBps(), 10000);
        for (uint256 i; i < 3; i++) assertEq(address(recipients[i]).balance, expectedReceipts[i]);
    }
}

contract CharacterLaunchNftInvariantTest is StdInvariant, Test {
    CharacterAuditNftHandler internal handler;
    function setUp() public {
        vm.warp(100 days);
        handler = new CharacterAuditNftHandler();
        handler.claim(63, 0, 0); // Non-vacuous baseline; random sequences then exercise state transitions.
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = handler.claim.selector;
        selectors[1] = handler.changeTime.selector;
        selectors[2] = handler.changeCap.selector;
        selectors[3] = handler.rotateSigner.selector;
        selectors[4] = handler.togglePause.selector;
        selectors[5] = handler.transfer.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector(address(handler), selectors));
    }
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_nftOwnershipNoncesSupplyAndDailyAccountingMatchModel() public view { handler.assertModel(); }
}

contract CharacterLaunchFeesInvariantTest is StdInvariant, Test {
    CharacterAuditFeesHandler internal handler;
    function setUp() public {
        handler = new CharacterAuditFeesHandler();
        // All four payment kinds seed the distribution model before mixed randomized sequences.
        for (uint8 kind; kind < 4; kind++) handler.payment(kind, 0, 0);
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = handler.payment.selector;
        selectors[1] = handler.changePrices.selector;
        selectors[2] = handler.rotateRecipients.selector;
        selectors[3] = handler.rejectRecipient.selector;
        selectors[4] = handler.forceAndMaybeSweep.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector(address(handler), selectors));
    }
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_feeReceiptsConserveGrossAndForcedFundsNeverBecomePayments() public view { handler.assertModel(); }
}
