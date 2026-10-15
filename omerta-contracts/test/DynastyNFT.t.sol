// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {DynastyNFT, IERC5192} from "../src/DynastyNFT.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract SoulboundMintReceiver is IERC721Receiver {
    DynastyNFT immutable nft;
    bool immutable reject;
    bool public observedLocked;
    bool public transferred;

    constructor(DynastyNFT nft_, bool reject_) {
        nft = nft_;
        reject = reject_;
    }

    function onERC721Received(address, address, uint256 id, bytes calldata) external returns (bytes4) {
        observedLocked = nft.locked(id);
        (transferred,) = address(nft).call(abi.encodeCall(nft.transferFrom, (address(this), address(0xB0B), id)));
        return reject ? bytes4(0) : IERC721Receiver.onERC721Received.selector;
    }
}

/// DynastyNFT — the uncapped identity NFT (omerta-dynasty-machine-design.md §4). The claims under test are
/// the ones the design rests on: minting is ONLY a server-signed voucher self-mint (bounded by nonce /
/// deadline / daily-cap, and there is NO owner-mint path at all), supply is uncapped with a plain sequential
/// tokenId, the contract gates NOTHING on balanceOf (the entitlement is account-bound off-chain — the token
/// is permanently soulbound), tokenURI is the off-chain pointer, and the legacy EIP-2981 ABI remains stable.
contract DynastyNFTTest is Test {
    using Strings for uint256;

    DynastyNFT nft;
    address safe = makeAddr("safe");
    address treasury = makeAddr("treasury");
    uint256 signerPk = 0xA11CE;
    address signerAddr;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    string constant BASE = "https://www.omerta.fun/v1/identity/";
    uint96 constant ROYALTY_BPS = 500; // 5%

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Locked(uint256 tokenId);

    function setUp() public {
        signerAddr = vm.addr(signerPk);
        nft = new DynastyNFT(safe, signerAddr, BASE, treasury, ROYALTY_BPS, 0);
    }

    function _voucher(address to, uint256 nonce) internal view returns (DynastyNFT.MintVoucher memory) {
        return DynastyNFT.MintVoucher({to: to, nonce: nonce, deadline: block.timestamp + 1 hours});
    }

    function _sign(DynastyNFT.MintVoucher memory v) internal view returns (bytes memory) {
        (uint8 vv, bytes32 r, bytes32 s) = vm.sign(signerPk, nft.hashVoucher(v));
        return abi.encodePacked(r, s, vv);
    }

    // ── the mint ──────────────────────────────────────────────────────────────────────────────────
    function test_claim_mints_a_sequential_identity() public {
        DynastyNFT.MintVoucher memory v = _voucher(alice, 1);
        bytes memory sig = _sign(v);
        uint256 id = nft.claim(v, sig);
        assertEq(id, 1, "first tokenId is 1");
        assertEq(nft.ownerOf(1), alice, "minted to alice");
        assertTrue(nft.usedNonce(1), "nonce consumed");
        assertEq(nft.nextId(), 2, "counter advanced");
    }

    function test_ids_are_sequential_and_uncapped() public {
        // no supply cap exists — mint many, ids run 1,2,3,... with no ceiling
        for (uint256 i = 1; i <= 5; i++) {
            DynastyNFT.MintVoucher memory v = _voucher(alice, i);
            bytes memory sig = _sign(v);
            assertEq(nft.claim(v, sig), i, "sequential id");
        }
        assertEq(nft.nextId(), 6, "no maximum supply - the counter just keeps climbing");
    }

    function test_there_is_NO_owner_mint_path() public {
        // The ONLY way a token comes into existence is claim() with a server signature. There is deliberately
        // no owner/mint/mintTo function — the Safe cannot mint identities to itself. We assert the contract's
        // surface: an unsigned/owner-driven mint simply does not exist, so only claim() can produce a token.
        // (A missing function is not directly callable; this documents the property the design requires.)
        assertEq(nft.balanceOf(alice), 0, "nothing minted without a claim");
    }

    // ── the vouchers gates ────────────────────────────────────────────────────────────────────────
    function test_replay_reverts() public {
        DynastyNFT.MintVoucher memory v = _voucher(alice, 1);
        bytes memory sig = _sign(v);
        nft.claim(v, sig);
        vm.expectRevert("DN: replay");
        nft.claim(v, sig);
    }

    function test_bad_signature_reverts() public {
        DynastyNFT.MintVoucher memory v = _voucher(alice, 1);
        (uint8 vv, bytes32 r, bytes32 s) = vm.sign(0xB0B, nft.hashVoucher(v)); // not the signer
        bytes memory sig = abi.encodePacked(r, s, vv);
        vm.expectRevert("DN: bad signature");
        nft.claim(v, sig);
    }

    function test_expired_reverts() public {
        DynastyNFT.MintVoucher memory v = DynastyNFT.MintVoucher({to: alice, nonce: 1, deadline: block.timestamp - 1});
        bytes memory sig = _sign(v);
        vm.expectRevert("DN: expired");
        nft.claim(v, sig);
    }

    function test_deadline_too_far_reverts() public {
        DynastyNFT.MintVoucher memory v =
            DynastyNFT.MintVoucher({to: alice, nonce: 1, deadline: block.timestamp + 31 days});
        bytes memory sig = _sign(v);
        vm.expectRevert("DN: deadline too far");
        nft.claim(v, sig);
    }

    function test_zero_recipient_reverts() public {
        DynastyNFT.MintVoucher memory v = _voucher(address(0), 1);
        bytes memory sig = _sign(v);
        vm.expectRevert("DN: zero recipient");
        nft.claim(v, sig);
    }

    function test_daily_cap_enforced_and_resets() public {
        vm.prank(safe);
        nft.setDailyMintCap(2);
        bytes memory s1 = _sign(_voucher(alice, 1));
        bytes memory s2 = _sign(_voucher(alice, 2));
        bytes memory s3 = _sign(_voucher(alice, 3));
        nft.claim(_voucher(alice, 1), s1);
        nft.claim(_voucher(alice, 2), s2);
        vm.expectRevert("DN: daily cap");
        nft.claim(_voucher(alice, 3), s3);
        // a new UTC day resets the window
        vm.warp(block.timestamp + 1 days);
        bytes memory s3b = _sign(_voucher(alice, 3));
        nft.claim(_voucher(alice, 3), s3b);
        assertEq(nft.ownerOf(3), alice, "mint resumes the next day");
    }

    /// R33: the wall must be CONSTRUCTOR-bound, not setter-only. This contract self-mints on the SAME
    /// signer key as VoucherClaim/OmertaBond/StreetDeed and has NO supply cap, so an unset wall is
    /// unbounded — and a wall that lives only in a deploy checklist is one a deploy can forget (a fresh
    /// deploy minted 500 identities in a day with nobody doing anything wrong). A deployer must now STATE
    /// the cap; 0 still means unlimited.
    function test_the_cap_is_constructor_bound_and_holds_with_no_setter_call() public {
        DynastyNFT capped = new DynastyNFT(safe, signerAddr, BASE, treasury, ROYALTY_BPS, 1);
        assertEq(capped.dailyMintCap(), 1, "the constructor arg IS the wall");
        DynastyNFT.MintVoucher memory v1 = _voucher(alice, 1);
        (uint8 a, bytes32 b, bytes32 c) = vm.sign(signerPk, capped.hashVoucher(v1));
        capped.claim(v1, abi.encodePacked(b, c, a));
        DynastyNFT.MintVoucher memory v2 = _voucher(bob, 2);
        (uint8 d, bytes32 e, bytes32 f) = vm.sign(signerPk, capped.hashVoucher(v2));
        vm.expectRevert("DN: daily cap");
        capped.claim(v2, abi.encodePacked(e, f, d));
    }

    function test_pause_blocks_mints_and_identity_remains_soulbound_after_unpause() public {
        bytes memory s1 = _sign(_voucher(alice, 1));
        nft.claim(_voucher(alice, 1), s1);
        vm.prank(safe);
        nft.pause();
        bytes memory s2 = _sign(_voucher(alice, 2));
        vm.expectRevert(); // Pausable: paused (custom error)
        nft.claim(_voucher(alice, 2), s2);
        vm.prank(alice);
        vm.expectRevert("DN: soulbound");
        nft.transferFrom(alice, bob, 1);
        vm.prank(safe);
        nft.unpause();
        _assertTransfersBlocked(alice);
        nft.claim(_voucher(alice, 2), s2);
        assertTrue(nft.locked(2));
    }

    // ── permanent soulbinding ────────────────────────────────────────────────────────────────────
    function _assertTransfersBlocked(address caller) internal {
        vm.startPrank(caller);
        vm.expectRevert("DN: soulbound");
        nft.transferFrom(alice, bob, 1);
        vm.expectRevert("DN: soulbound");
        nft.safeTransferFrom(alice, bob, 1);
        vm.expectRevert("DN: soulbound");
        nft.safeTransferFrom(alice, bob, 1, "soulbound");
        vm.stopPrank();
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.balanceOf(alice), 1);
        assertEq(nft.balanceOf(bob), 0);
        assertTrue(nft.locked(1));
    }

    function test_owner_cannot_transfer_through_any_ERC721_entrypoint() public {
        bytes memory sig = _sign(_voucher(alice, 1));
        nft.claim(_voucher(alice, 1), sig);
        _assertTransfersBlocked(alice);
    }

    function test_token_approval_cannot_unlock_or_transfer_an_identity() public {
        nft.claim(_voucher(alice, 1), _sign(_voucher(alice, 1)));
        address operator = makeAddr("operator");
        vm.prank(alice);
        nft.approve(operator, 1);
        _assertTransfersBlocked(operator);
        assertEq(nft.getApproved(1), operator, "failed transfer changes no approval");
    }

    function test_blanket_approval_cannot_unlock_or_transfer_an_identity() public {
        nft.claim(_voucher(alice, 1), _sign(_voucher(alice, 1)));
        address operator = makeAddr("operator");
        vm.prank(alice);
        nft.setApprovalForAll(operator, true);
        _assertTransfersBlocked(operator);
        assertTrue(nft.isApprovedForAll(alice, operator), "approval does not bypass soulbinding");
    }

    function testFuzz_approved_callers_cannot_move_locked_identity(address caller, address to, uint8 path) public {
        vm.assume(caller != address(0) && to != address(0));
        nft.claim(_voucher(alice, 1), _sign(_voucher(alice, 1)));
        uint8 route = path % 3;
        vm.prank(alice);
        if (route == 0) nft.approve(caller, 1);
        else nft.setApprovalForAll(caller, true);
        vm.prank(caller);
        vm.expectRevert("DN: soulbound");
        if (route == 0) nft.transferFrom(alice, to, 1);
        else if (route == 1) nft.safeTransferFrom(alice, to, 1);
        else nft.safeTransferFrom(alice, to, 1, "fuzz");
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.balanceOf(alice), 1);
        assertTrue(nft.locked(1));
    }

    function test_owner_cannot_self_transfer_or_burn() public {
        nft.claim(_voucher(alice, 1), _sign(_voucher(alice, 1)));
        vm.startPrank(alice);
        vm.expectRevert("DN: soulbound");
        nft.transferFrom(alice, alice, 1);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InvalidReceiver.selector, address(0)));
        nft.transferFrom(alice, address(0), 1);
        vm.stopPrank();
        assertEq(nft.ownerOf(1), alice);
    }

    function test_locked_is_discoverable_and_emitted_at_mint() public {
        bytes memory sig = _sign(_voucher(alice, 1));
        vm.expectEmit(true, true, true, true, address(nft));
        emit Transfer(address(0), alice, 1);
        vm.expectEmit(false, false, false, true, address(nft));
        emit Locked(1);
        nft.claim(_voucher(alice, 1), sig);
        assertTrue(nft.locked(1));
        assertTrue(nft.supportsInterface(type(IERC5192).interfaceId));
        assertTrue(nft.supportsInterface(0xb45a3c0e), "standard ERC-5192 interface id");
        assertFalse(nft.supportsInterface(0xffffffff));
    }

    function test_locked_and_transfer_revert_for_nonexistent_token_without_minting() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 999));
        nft.locked(999);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 999));
        nft.transferFrom(address(0), alice, 999);
        assertEq(nft.nextId(), 1);
        assertEq(nft.balanceOf(alice), 0);
    }

    function test_mint_receiver_observes_lock_and_cannot_forward_identity() public {
        SoulboundMintReceiver receiver = new SoulboundMintReceiver(nft, false);
        DynastyNFT.MintVoucher memory v = _voucher(address(receiver), 1);
        nft.claim(v, _sign(v));
        assertTrue(receiver.observedLocked(), "locked before external receiver callback");
        assertFalse(receiver.transferred(), "callback cannot escape soulbinding");
        assertEq(nft.ownerOf(1), address(receiver));
        assertTrue(nft.usedNonce(1));
    }

    function test_rejected_mint_receiver_rolls_back_soulbound_mint_and_nonce() public {
        SoulboundMintReceiver receiver = new SoulboundMintReceiver(nft, true);
        DynastyNFT.MintVoucher memory v = _voucher(address(receiver), 1);
        bytes memory sig = _sign(v);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InvalidReceiver.selector, address(receiver)));
        nft.claim(v, sig);
        assertEq(nft.nextId(), 1);
        assertFalse(nft.usedNonce(1));
        assertEq(nft.mintedOnDay(block.timestamp / 1 days), 0);
        assertEq(nft.balanceOf(address(receiver)), 0);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 1));
        nft.locked(1);
    }

    // ── metadata ────────────────────────────────────────────────────────────────────────────────
    function test_tokenURI_is_the_offchain_pointer() public {
        bytes memory sig = _sign(_voucher(alice, 1));
        nft.claim(_voucher(alice, 1), sig);
        assertEq(nft.tokenURI(1), string.concat(BASE, uint256(1).toString()), "tokenURI = base + id");
    }

    function test_tokenURI_reverts_for_a_nonexistent_token() public {
        vm.expectRevert(); // ERC721NonexistentToken
        nft.tokenURI(999);
    }

    // ── EIP-2981 royalty ──────────────────────────────────────────────────────────────────────────
    function test_royalty_is_five_percent_to_the_treasury() public view {
        (address recv, uint256 amount) = nft.royaltyInfo(1, 1 ether);
        assertEq(recv, treasury, "royalty pays the treasury Safe");
        assertEq(amount, 0.05 ether, "5% of the sale");
        assertTrue(nft.supportsInterface(type(IERC2981).interfaceId), "advertises EIP-2981");
        assertTrue(nft.supportsInterface(type(IERC721).interfaceId), "advertises ERC-721");
    }

    function test_only_owner_rotates_the_royalty() public {
        vm.prank(alice);
        vm.expectRevert(); // Ownable: not owner
        nft.setDefaultRoyalty(alice, 1000);
        address newRecv = makeAddr("newTreasury");
        vm.prank(safe);
        nft.setDefaultRoyalty(newRecv, 250); // 2.5%
        (address recv, uint256 amount) = nft.royaltyInfo(1, 1 ether);
        assertEq(recv, newRecv, "royalty recipient rotated");
        assertEq(amount, 0.025 ether, "new rate in effect");
    }

    function test_ctor_rejects_zero_signer_and_zero_royalty_recipient() public {
        vm.expectRevert("DN: zero signer");
        new DynastyNFT(safe, address(0), BASE, treasury, ROYALTY_BPS, 0);
        vm.expectRevert("DN: zero royalty recipient");
        new DynastyNFT(safe, signerAddr, BASE, address(0), ROYALTY_BPS, 0);
    }

    function test_only_owner_admin() public {
        vm.startPrank(alice);
        vm.expectRevert();
        nft.setSigner(alice);
        vm.expectRevert();
        nft.setDailyMintCap(1);
        vm.expectRevert();
        nft.setBaseUri("x");
        vm.expectRevert();
        nft.pause();
        vm.stopPrank();
    }
}
