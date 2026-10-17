// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {stdStorage, StdStorage} from "forge-std/StdStorage.sol";
import {
    CharacterDeedCustody,
    CharacterDeedAccount,
    IDeedAccountRegistry,
    IDeedVolumeSource
} from "../src/CharacterDeedCustody.sol";
import {DeedStockAccount} from "../src/DeedStockAccount.sol";
import {StreetDeed} from "../src/StreetDeed.sol";
import {DynastyNFT} from "../src/DynastyNFT.sol";
import {ERC6551Registry} from "./vendor/ERC6551Registry.sol";
import {OmertaRestrictedOMRV2} from "../src/market-v2/OmertaRestrictedOMRV2.sol";
import {IOmertaRestrictedOMRV2} from "../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CustodyVolumeSource {
    address public immutable omr;
    uint16 public constant TRADE_FEE_BPS = 500;
    bytes32 public constant revenuePolicyId = keccak256("OMERTA_RESTRICTED_LP_REVENUE_V2_500_BOTH_DIRECTIONS");
    uint256 public volumeTrackingStartDay;
    mapping(uint256 => uint256) public dailyOmrVolume;

    constructor(address token) {
        omr = token;
        volumeTrackingStartDay = block.timestamp / 1 days - 2;
    }

    function setVolume(uint256 day, uint256 volume) external {
        dailyOmrVolume[day] = volume;
    }

    function setStart(uint256 day) external {
        volumeTrackingStartDay = day;
    }
}

contract CustodyFundingProbe {
    function fund(IOmertaRestrictedOMRV2 token, address from, address to, uint256 amount) external {
        token.transferFrom(from, address(this), amount);
        token.transfer(to, amount);
    }
}

contract CustodyStock is ERC20 {
    constructor() ERC20("Stock", "STOCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function permit1271(address holder, address spender, uint256 amount, bytes calldata signature) external {
        require(IERC1271(holder).isValidSignature(keccak256("permit"), signature) == 0x1626ba7e, "invalid permit");
        _approve(holder, spender, amount);
    }
}

contract CustodyReentrantStock is CustodyStock {
    address public vault;
    bool public tried;
    bool public reentered;
    bytes4 public reason;

    function arm(address vault_) external {
        vault = vault_;
    }

    function _update(address from, address to, uint256 amount) internal override {
        super._update(from, to, amount);
        if (vault != address(0) && from == vault && !tried) {
            tried = true;
            bytes memory errorData;
            (reentered, errorData) = vault.call(abi.encodeCall(DeedStockAccount.withdrawERC20, (address(this), 1)));
            if (errorData.length >= 4) reason = bytes4(errorData);
        }
    }
}

contract CustodyExitWallet is IERC1271, IERC721Receiver {
    bytes32 public approvedDigest;
    bool public rejectReceipt;

    function setDigest(bytes32 digest, bool reject_) external {
        approvedDigest = digest;
        rejectReceipt = reject_;
    }

    function isValidSignature(bytes32 digest, bytes memory) external view returns (bytes4) {
        return digest == approvedDigest ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external view returns (bytes4) {
        require(!rejectReceipt, "receipt rejected");
        return IERC721Receiver.onERC721Received.selector;
    }
}

abstract contract CharacterDeedCustodyFixture is Test {
    using stdStorage for StdStorage;
    uint256 sequenceSlot;
    uint256 constant SIGNER_KEY = 0xCAFE01;
    uint256 constant ALICE_KEY = 0xA11CE;
    bytes32 constant A = keccak256("life-a");
    bytes32 constant B = keccak256("life-b");
    bytes32 constant C = keccak256("life-c");
    address safe = makeAddr("safe");
    address operator = makeAddr("operator");
    address alice;
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    StreetDeed deed;
    DynastyNFT dynasty;
    ERC6551Registry registry;
    CharacterDeedCustody custody;
    CustodyStock stock;
    OmertaRestrictedOMRV2 omr;
    CustodyVolumeSource volumeSource;
    CustodyFundingProbe funding;
    uint256 deedId;

    function setUp() public virtual {
        vm.warp(100 days);
        alice = vm.addr(ALICE_KEY);
        address signer = vm.addr(SIGNER_KEY);
        deed = new StreetDeed(safe, signer, "image/", "external/", 0);
        dynasty = new DynastyNFT(safe, signer, "identity/", safe, 500, 0);
        registry = new ERC6551Registry();
        omr = new OmertaRestrictedOMRV2(safe);
        volumeSource = new CustodyVolumeSource(address(omr));
        funding = new CustodyFundingProbe();
        custody = new CharacterDeedCustody(
            safe,
            operator,
            deed,
            dynasty,
            IDeedAccountRegistry(address(registry)),
            IOmertaRestrictedOMRV2(address(omr)),
            IDeedVolumeSource(address(volumeSource))
        );
        sequenceSlot = stdstore.target(address(custody)).sig("deathSequence()").find();
        vm.startPrank(safe);
        omr.setOperator(
            address(custody), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(custody).codehash
        );
        omr.setOperator(
            address(funding), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(funding).codehash
        );
        omr.bindSettlementManager(address(volumeSource), address(volumeSource).codehash);
        omr.sealPolicy();
        omr.approve(address(funding), type(uint256).max);
        vm.stopPrank();
        vm.prank(alice, alice);
        omr.registerWallet(alice);
        funding.fund(omr, safe, alice, 1000 ether);
        vm.prank(alice);
        omr.approve(address(custody), type(uint256).max);
        volumeSource.setVolume(block.timestamp / 1 days - 1, 100_000 ether);
        stock = new CustodyStock();
        _mintIdentity(alice, 1);
        _mintIdentity(bob, 2);
        _mintIdentity(carol, 3);
        vm.startPrank(operator);
        custody.registerLife(A, 1);
        custody.registerLife(B, 2);
        custody.registerLife(C, 3);
        custody.registerPendingLife(_heirId(A));
        custody.registerPendingLife(_heirId(B));
        custody.registerPendingLife(_heirId(C));
        vm.stopPrank();
        deedId = _mintDeed(alice, "Mulberry Lane", 1);
    }

    function _signature(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _mintIdentity(address wallet, uint256 nonce) internal {
        DynastyNFT.MintVoucher memory voucher = DynastyNFT.MintVoucher(wallet, nonce, block.timestamp + 1 hours);
        dynasty.claim(voucher, _signature(SIGNER_KEY, dynasty.hashVoucher(voucher)));
    }

    function _mintDeed(address wallet, string memory name, uint256 nonce) internal returns (uint256 id) {
        StreetDeed.DeedVoucher memory voucher =
            StreetDeed.DeedVoucher(wallet, name, "Downtown", nonce, block.timestamp + 1 hours);
        deed.claim(voucher, _signature(SIGNER_KEY, deed.hashVoucher(voucher)));
        return deed.tokenIdFor(name);
    }

    function _equip() internal returns (DeedStockAccount vault) {
        vm.startPrank(alice);
        deed.setTransferLock(deedId, false);
        deed.approve(address(custody), deedId);
        custody.equip(A, deedId);
        vm.stopPrank();
        vault = DeedStockAccount(payable(custody.deedVault(deedId)));
        stock.mint(address(vault), 100 ether);
    }

    function _heirId(bytes32 victim) internal pure returns (bytes32) {
        return keccak256(abi.encode("safe-heir", victim));
    }

    function _nextSequence() internal view returns (uint256) {
        return uint256(vm.load(address(custody), bytes32(sequenceSlot))) + 1;
    }

    function _death(bytes32 victim, bytes32 killer) internal {
        bytes32 heir = _heirId(victim);
        if (custody.accountOf(heir) == address(0)) {
            vm.prank(operator);
            custody.registerPendingLife(heir);
        }
        vm.prank(operator);
        custody.recordDeath(victim, killer, heir, _nextSequence(), block.timestamp);
    }

    function _exit() internal view returns (CharacterDeedCustody.ExitRequest memory) {
        return
            CharacterDeedCustody.ExitRequest(
                A, deedId, custody.exitNonce(A), block.timestamp, block.timestamp + 2 minutes
            );
    }
}

contract CharacterDeedCustodyTest is CharacterDeedCustodyFixture {
    function _safeRequest(bytes32 life, uint256 days_)
        internal
        view
        returns (CharacterDeedCustody.SafeHouseRequest memory)
    {
        return CharacterDeedCustody.SafeHouseRequest(
            life,
            deedId,
            days_,
            block.timestamp / 1 days,
            25 ether * days_,
            custody.safeHouseNonce(life),
            block.timestamp,
            block.timestamp + 2 minutes
        );
    }

    function _prepay(bytes32 life, uint256 days_) internal {
        CharacterDeedCustody.SafeHouseRequest memory request = _safeRequest(life, days_);
        bytes memory sig = _signature(ALICE_KEY, custody.hashSafeHouse(request));
        vm.prank(operator);
        custody.prepaySafeHouse(request, sig);
    }

    function test_safe_house_burns_approved_real_OMR_and_covers_whole_vault() public {
        DeedStockAccount vault = _equip();
        vm.deal(address(vault), 3 ether);
        uint256 beforeSupply = omr.totalSupply();
        uint256 beforeWallet = omr.balanceOf(alice);
        uint256 start = block.timestamp + 1;
        _prepay(A, 2);
        assertEq(omr.totalSupply(), beforeSupply - 10 ether);
        assertEq(omr.balanceOf(alice), beforeWallet - 10 ether);
        assertEq(omr.balanceOf(address(custody)), 0);
        assertFalse(custody.safeHouseCoveredAt(deedId, 1, start - 1));
        assertTrue(custody.safeHouseCoveredAt(deedId, 1, start));
        vm.warp(start + 1 hours);
        _death(A, B);
        _death(B, C);
        vm.expectRevert("DC: no settlement");
        custody.settleDeed(deedId, 32);
        vm.warp(custody.estateReleaseAt(A));
        assertEq(custody.settleDeed(deedId, 32), _heirId(A));
        assertEq(stock.balanceOf(address(vault)), 100 ether);
        assertEq(address(vault).balance, 3 ether);
        assertEq(deed.ownerOf(deedId), custody.accountOf(_heirId(A)));
    }

    function test_safe_house_price_uses_previous_complete_day_with_floor_ceiling_and_no_partial_day() public {
        (uint256 day, uint256 volume, uint256 price) = custody.safeHouseQuote();
        assertEq(day, block.timestamp / 1 days);
        assertEq(volume, 100_000 ether);
        assertEq(price, 5 ether);
        volumeSource.setVolume(day, 100_000_000 ether);
        (,, price) = custody.safeHouseQuote();
        assertEq(price, 5 ether);
        volumeSource.setVolume(day - 1, 0);
        (,, price) = custody.safeHouseQuote();
        assertEq(price, 1 ether);
        volumeSource.setVolume(day - 1, 1_000_000 ether);
        (,, price) = custody.safeHouseQuote();
        assertEq(price, 25 ether);
        volumeSource.setStart(day - 1);
        (,, price) = custody.safeHouseQuote();
        assertEq(price, 25 ether);
        volumeSource.setStart(day);
        vm.expectRevert("DC: full volume day unavailable");
        custody.safeHouseQuote();
    }

    function test_safe_house_signature_nonce_price_day_allowance_and_horizon_are_atomic() public {
        _equip();
        CharacterDeedCustody.SafeHouseRequest memory r = _safeRequest(A, 1);
        bytes memory sig = _signature(ALICE_KEY, custody.hashSafeHouse(r));
        vm.expectRevert("DC: only operator");
        custody.prepaySafeHouse(r, sig);
        vm.prank(operator);
        vm.expectRevert("DC: owner signature");
        custody.prepaySafeHouse(r, "bad");
        vm.prank(alice);
        omr.approve(address(custody), 0);
        vm.prank(operator);
        vm.expectRevert();
        custody.prepaySafeHouse(r, sig);
        assertEq(custody.safeHouseNonce(A), 0);
        assertEq(custody.safeHouseUntil(deedId, 1), 0);
        vm.prank(alice);
        omr.approve(address(custody), type(uint256).max);
        vm.prank(operator);
        custody.prepaySafeHouse(r, sig);
        vm.prank(operator);
        vm.expectRevert("DC: safe house nonce");
        custody.prepaySafeHouse(r, sig);
        _prepay(A, 6);
        r = _safeRequest(A, 1);
        sig = _signature(ALICE_KEY, custody.hashSafeHouse(r));
        vm.prank(operator);
        vm.expectRevert("DC: prepaid horizon");
        custody.prepaySafeHouse(r, sig);
        assertEq(custody.safeHouseUntil(deedId, 1), block.timestamp + 1 + 7 days);
    }

    function test_safe_house_rejects_UTC_rollover_and_changed_maximum_burn() public {
        _equip();
        CharacterDeedCustody.SafeHouseRequest memory r = _safeRequest(A, 1);
        r.maxBurn = 4 ether;
        bytes memory sig = _signature(ALICE_KEY, custody.hashSafeHouse(r));
        vm.prank(operator);
        vm.expectRevert("DC: burn exceeds consent");
        custody.prepaySafeHouse(r, sig);
        vm.warp(block.timestamp / 1 days * 1 days + 1 days - 30);
        r = _safeRequest(A, 1);
        sig = _signature(ALICE_KEY, custody.hashSafeHouse(r));
        vm.warp(block.timestamp + 31);
        vm.prank(operator);
        vm.expectRevert("DC: price day changed");
        custody.prepaySafeHouse(r, sig);
        assertEq(custody.safeHouseNonce(A), 0);
    }

    function test_expired_coverage_routes_to_successive_killers_and_does_not_protect_other_dynasty() public {
        _equip();
        _prepay(A, 1);
        vm.warp(custody.safeHouseUntil(deedId, 1));
        _death(A, B);
        _death(B, C);
        assertEq(custody.settleDeed(deedId, 32), C);
        assertFalse(custody.safeHouseCoveredAt(deedId, 2, block.timestamp - 1));
    }

    function test_late_purchase_cannot_retroactively_protect_an_unreported_death() public {
        _equip();
        uint256 deathAt = block.timestamp;
        vm.warp(deathAt + 15);
        _prepay(A, 1);
        vm.prank(operator);
        custody.recordDeath(A, B, _heirId(A), 1, deathAt);
        assertEq(custody.settleDeed(deedId, 32), B);
        _death(B, C);
        assertEq(custody.settleDeed(deedId, 32), C, "Alice's coverage must not shield Bob");
    }

    function test_coverage_history_preserves_gaps_and_renewals_and_expiry_boundary() public {
        _equip();
        uint256 first = block.timestamp + 1;
        _prepay(A, 1);
        uint256 end = custody.safeHouseUntil(deedId, 1);
        vm.warp(end + 2 hours);
        _prepay(A, 1);
        assertTrue(custody.safeHouseCoveredAt(deedId, 1, first));
        assertFalse(custody.safeHouseCoveredAt(deedId, 1, end));
        assertFalse(custody.safeHouseCoveredAt(deedId, 1, end + 1 hours));
        assertTrue(custody.safeHouseCoveredAt(deedId, 1, block.timestamp + 1));
        _prepay(A, 1);
        assertTrue(custody.safeHouseCoveredAt(deedId, 1, block.timestamp + 1 days));
    }

    function test_protected_heir_death_before_prior_settlement_keeps_same_account_coverage() public {
        _equip();
        _prepay(A, 3);
        vm.warp(block.timestamp + 1);
        _death(A, B);
        bytes32 heir = _heirId(A);
        _death(heir, C);
        vm.warp(custody.estateReleaseAt(heir));
        assertEq(custody.settleDeed(deedId, 32), _heirId(heir));
        assertEq(custody.lifeState(_heirId(heir)).dynastyId, 1);
    }

    function test_death_timestamp_and_sequence_reject_stale_future_and_reordered_transactions() public {
        vm.prank(operator);
        vm.expectRevert("DC: death sequence");
        custody.recordDeath(A, B, _heirId(A), 2, block.timestamp);
        vm.prank(operator);
        vm.expectRevert("DC: death time");
        custody.recordDeath(A, B, _heirId(A), 1, block.timestamp + 1);
        _death(A, B);
        vm.prank(operator);
        vm.expectRevert("DC: death time");
        custody.recordDeath(B, C, _heirId(B), 2, block.timestamp - 1);
        assertFalse(custody.lifeState(B).dead);
    }

    function test_native_currency_withdrawal_is_owner_only_and_equipment_locks_it() public {
        address vault = custody.ensureDeedVault(deedId);
        vm.deal(vault, 4 ether);
        vm.prank(bob);
        vm.expectRevert("DSA: not owner");
        DeedStockAccount(payable(vault)).withdrawNative(1 ether);
        uint256 before = alice.balance;
        vm.prank(alice);
        DeedStockAccount(payable(vault)).withdrawNative(1 ether);
        assertEq(alice.balance, before + 1 ether);
        _equip();
        vm.prank(alice);
        vm.expectRevert("DSA: equipped");
        DeedStockAccount(payable(vault)).withdrawNative(1 ether);
        _death(A, B);
        _death(B, C);
        custody.settleDeed(deedId, 32);
        assertEq(vault.balance, 3 ether);
    }

    function test_life_registry_is_operator_only_unique_and_bound_to_soulbound_owner() public {
        CharacterDeedCustody.Life memory life = custody.lifeState(A);
        assertEq(life.wallet, alice);
        assertEq(life.dynastyId, 1);
        assertEq(life.account, custody.accountOf(A));
        assertEq(custody.lifeOfAccount(life.account), A);
        assertEq(custody.activeLifeByDynasty(1), A);
        assertEq(CharacterDeedAccount(life.account).lifeId(), A);
        vm.expectRevert("DC: only operator");
        custody.registerPendingLife(keccak256("unauthorized"));
        vm.startPrank(operator);
        vm.expectRevert("DC: life exists");
        custody.registerLife(A, 1);
        vm.expectRevert("DC: zero life");
        custody.registerPendingLife(bytes32(0));
        vm.expectRevert("DC: identity already active");
        custody.registerLife(keccak256("second-live"), 1);
        vm.stopPrank();
    }

    function test_equipment_requires_direct_owner_unlock_and_approval() public {
        vm.expectRevert("DC: not life owner");
        custody.equip(A, deedId);
        vm.startPrank(alice);
        deed.approve(address(custody), deedId);
        vm.expectRevert("SD: locked - unlock before transfer");
        custody.equip(A, deedId);
        deed.setTransferLock(deedId, false);
        deed.approve(address(0), deedId);
        vm.expectRevert();
        custody.equip(A, deedId);
        vm.stopPrank();
        _equip();
        assertEq(deed.ownerOf(deedId), custody.accountOf(A));
        assertEq(custody.equippedLife(deedId), A);
        assertTrue(deed.transferLocked(deedId));
        assertEq(deed.getApproved(deedId), address(0));
    }

    function test_equipped_account_has_no_unlock_redeem_approval_or_execute_bypass() public {
        DeedStockAccount vault = _equip();
        address account = custody.accountOf(A);
        vm.startPrank(alice);
        vm.expectRevert("SD: not owner");
        deed.setTransferLock(deedId, false);
        vm.expectRevert("SD: not owner");
        deed.redeem(deedId);
        vm.expectRevert();
        deed.approve(alice, deedId);
        vm.expectRevert("CDA: only custody");
        CharacterDeedAccount(account).release(deedId, alice);
        (bool ok,) = account.call(
            abi.encodeWithSignature(
                "execute(address,uint256,bytes,uint8)",
                address(deed),
                0,
                abi.encodeCall(deed.setTransferLock, (deedId, false)),
                0
            )
        );
        assertFalse(ok);
        vm.stopPrank();
        vm.prank(account);
        vm.expectRevert("DSA: equipped");
        vault.withdrawERC20(address(stock), 1);
        vm.prank(alice);
        vm.expectRevert("DSA: equipped");
        vault.withdrawERC20(address(stock), 1);
        assertEq(stock.balanceOf(address(vault)), 100 ether);
    }

    function test_canonical_vault_cannot_create_allowances_or_delegate_signatures_even_unequipped() public {
        address vaultAddress = custody.ensureDeedVault(deedId);
        DeedStockAccount vault = DeedStockAccount(payable(vaultAddress));
        stock.mint(vaultAddress, 100);
        bytes memory approveData = abi.encodeCall(IERC20.approve, (bob, type(uint256).max));
        vm.startPrank(alice);
        (bool direct,) = vaultAddress.call(approveData);
        (bool generic,) = vaultAddress.call(
            abi.encodeWithSignature("execute(address,uint256,bytes,uint8)", address(stock), 0, approveData, 0)
        );
        assertFalse(direct);
        assertFalse(generic);
        assertEq(vault.isValidSignature(keccak256("permit"), "anything"), bytes4(0xffffffff));
        assertEq(vault.isValidSigner(alice, ""), bytes4(0));
        vm.expectRevert("invalid permit");
        stock.permit1271(vaultAddress, bob, 100, "owner signature");
        vm.stopPrank();
        assertEq(stock.allowance(vaultAddress, bob), 0);
        vm.prank(bob);
        vm.expectRevert();
        stock.transferFrom(vaultAddress, bob, 1);
        vm.prank(alice);
        vault.withdrawERC20(address(stock), 10);
        assertEq(stock.balanceOf(alice), 10);
        assertEq(vault.state(), 1);
        assertTrue(vault.supportsInterface(0x6faff5f1));
        assertFalse(vault.supportsInterface(0xffffffff));
        (uint256 chainId, address collection, uint256 id) = vault.token();
        assertEq(chainId, block.chainid);
        assertEq(collection, address(deed));
        assertEq(id, deedId);
    }

    function test_vault_withdrawal_reentry_fails_and_no_arbitrary_external_execute_exists() public {
        address vaultAddress = custody.ensureDeedVault(deedId);
        CustodyReentrantStock malicious = new CustodyReentrantStock();
        malicious.mint(vaultAddress, 100);
        malicious.arm(vaultAddress);
        vm.prank(alice);
        DeedStockAccount(payable(vaultAddress)).withdrawERC20(address(malicious), 10);
        assertTrue(malicious.tried());
        assertFalse(malicious.reentered());
        assertEq(malicious.reason(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(malicious.balanceOf(vaultAddress), 90);
        assertEq(malicious.balanceOf(alice), 10);
    }

    function test_unsafe_deposit_still_counts_as_equipped_and_locks_stock() public {
        address vaultAddress = custody.ensureDeedVault(deedId);
        stock.mint(vaultAddress, 100);
        vm.startPrank(alice);
        deed.setTransferLock(deedId, false);
        deed.transferFrom(alice, custody.accountOf(A), deedId);
        vm.stopPrank();
        assertEq(custody.equippedLife(deedId), A);
        vm.prank(alice);
        vm.expectRevert("DSA: equipped");
        DeedStockAccount(payable(vaultAddress)).withdrawERC20(address(stock), 1);
        _death(A, B);
        custody.settleDeed(deedId, 1);
        assertEq(deed.ownerOf(deedId), custody.accountOf(B));
    }

    function test_successive_killers_receive_same_deed_vault_and_heir_never_receives_old_life_loot() public {
        DeedStockAccount vault = _equip();
        _death(A, B);
        _death(B, C);
        bytes32 heir = custody.lifeState(B).heir;
        custody.settleDeed(deedId, 1);
        assertEq(deed.ownerOf(deedId), custody.accountOf(B), "bounded partial progress stops at dead original B");
        custody.settleDeed(deedId, 1);
        assertEq(deed.ownerOf(deedId), custody.accountOf(C));
        assertEq(custody.deedVault(deedId), address(vault));
        assertEq(stock.balanceOf(address(vault)), 100 ether);
        assertEq(deed.balanceOf(custody.accountOf(heir)), 0);
        vm.expectRevert("DC: no settlement");
        custody.settleDeed(deedId, 32);
    }

    function test_pending_unminted_killer_can_receive_then_die_and_bind_without_redirecting_to_heir() public {
        _equip();
        bytes32 pending = keccak256("unminted-killer");
        vm.prank(operator);
        address pendingAccount = custody.registerPendingLife(pending);
        _death(A, pending);
        _death(pending, C);
        vm.prank(operator);
        custody.bindLife(pending, 2);
        CharacterDeedCustody.Life memory life = custody.lifeState(pending);
        assertEq(life.account, pendingAccount);
        assertTrue(life.dead);
        assertEq(life.killer, C);
        assertEq(life.wallet, bob);
        assertEq(custody.activeLifeByDynasty(2), B, "binding dead life does not overwrite a live generation");
        custody.settleDeed(deedId, 32);
        assertEq(deed.ownerOf(deedId), custody.accountOf(C));
    }

    function test_zero_killer_requires_heir_and_player_death_is_single_use_ordered_and_acyclic() public {
        _equip();
        vm.expectRevert("DC: only operator");
        custody.recordDeath(A, B, _heirId(A), _nextSequence(), block.timestamp);
        vm.prank(operator);
        vm.expectRevert("DC: killer not live");
        custody.recordDeath(A, A, _heirId(A), _nextSequence(), block.timestamp);
        vm.prank(operator);
        vm.expectRevert("DC: estate requires heir");
        custody.recordDeath(A, bytes32(0), _heirId(A), _nextSequence(), block.timestamp);
        _death(A, B);
        assertEq(custody.lifeState(A).deathSequence, 1);
        assertEq(custody.deathSequence(), 1);
        vm.prank(operator);
        vm.expectRevert("DC: victim not live");
        custody.recordDeath(A, B, _heirId(A), _nextSequence(), block.timestamp);
        vm.prank(operator);
        vm.expectRevert("DC: killer not live");
        custody.recordDeath(B, A, _heirId(B), _nextSequence(), block.timestamp);
        assertEq(deed.ownerOf(deedId), custody.accountOf(A));
        vm.startPrank(alice);
        vm.expectRevert("DC: life not live");
        custody.equip(A, deedId);
        vm.stopPrank();
    }

    function test_estate_auto_binds_same_identity_heir_and_releases_only_after_24_hours() public {
        DeedStockAccount vault = _equip();
        bytes32 heir = keccak256("alice-estate-heir");
        vm.prank(operator);
        custody.registerPendingLife(heir);
        uint256 recordedAt = block.timestamp;
        vm.prank(operator);
        custody.recordEstateDeath(A, heir, _nextSequence(), block.timestamp);
        CharacterDeedCustody.Life memory successor = custody.lifeState(heir);
        assertEq(successor.dynastyId, 1);
        assertEq(successor.wallet, alice);
        assertEq(custody.activeLifeByDynasty(1), heir);
        assertEq(custody.estateParentOf(heir), A);
        assertEq(custody.estateFamilyOf(heir), A);
        assertEq(custody.estateReleaseAt(A), recordedAt + 24 hours);
        vm.warp(recordedAt + 24 hours - 1);
        vm.expectRevert("DC: no settlement");
        custody.settleDeed(deedId, 32);
        vm.prank(alice);
        vm.expectRevert("DSA: equipped");
        vault.withdrawERC20(address(stock), 1);
        vm.warp(recordedAt + 24 hours);
        assertEq(custody.settleDeed(deedId, 32), heir);
        assertEq(deed.ownerOf(deedId), successor.account);
        assertEq(stock.balanceOf(address(vault)), 100 ether);
    }

    function test_player_loot_waits_at_immature_estate_then_follows_killed_heir_to_next_killer() public {
        DeedStockAccount vault = _equip();
        bytes32 heir = keccak256("bob-estate-heir");
        vm.prank(operator);
        custody.registerPendingLife(heir);
        _death(A, B);
        vm.prank(operator);
        custody.recordEstateDeath(B, heir, _nextSequence(), block.timestamp);
        uint256 releaseAt = custody.estateReleaseAt(B);
        _death(heir, C);
        assertEq(custody.settleDeed(deedId, 32), B, "player edge advances only as far as immature estate");
        assertEq(deed.ownerOf(deedId), custody.accountOf(B));
        vm.expectRevert("DC: no settlement");
        custody.settleDeed(deedId, 32);
        vm.prank(bob);
        vm.expectRevert("DSA: equipped");
        vault.withdrawERC20(address(stock), 1);
        vm.warp(releaseAt);
        assertEq(custody.settleDeed(deedId, 32), C);
        assertEq(stock.balanceOf(address(vault)), 100 ether);
        assertEq(deed.balanceOf(custody.accountOf(heir)), 0, "dead heir never temporarily receives settled loot");
    }

    function test_estate_rejects_wrong_identity_reused_heir_self_and_replay_without_rewriting_edge() public {
        _equip();
        vm.prank(operator);
        vm.expectRevert("DC: heir identity mismatch");
        custody.recordEstateDeath(A, B, _nextSequence(), block.timestamp);
        assertFalse(custody.lifeState(A).dead);
        assertEq(custody.activeLifeByDynasty(1), A);
        vm.prank(operator);
        vm.expectRevert("DC: killer not live");
        custody.recordEstateDeath(A, A, _nextSequence(), block.timestamp);
        bytes32 heir = keccak256("unique-estate-heir");
        vm.prank(operator);
        custody.registerPendingLife(heir);
        vm.prank(operator);
        custody.recordEstateDeath(A, heir, _nextSequence(), block.timestamp);
        uint256 releaseAt = custody.estateReleaseAt(A);
        vm.prank(operator);
        vm.expectRevert("DC: victim not live");
        custody.recordEstateDeath(A, C, _nextSequence(), block.timestamp);
        vm.prank(operator);
        vm.expectRevert("DC: heir already assigned");
        custody.recordEstateDeath(B, heir, _nextSequence(), block.timestamp);
        assertEq(custody.lifeState(A).killer, heir);
        assertEq(custody.estateReleaseAt(A), releaseAt);
        assertFalse(custody.lifeState(B).dead);
    }

    function test_unminted_estate_lineage_enforces_identity_when_bound_in_either_order() public {
        _mintIdentity(alice, 4);
        _mintIdentity(bob, 5);
        bytes32 victim = keccak256("pending-estate-parent");
        bytes32 heir = keccak256("pending-estate-heir");
        vm.startPrank(operator);
        custody.registerPendingLife(victim);
        custody.registerPendingLife(heir);
        custody.recordEstateDeath(victim, heir, _nextSequence(), block.timestamp);
        custody.bindLife(heir, 4);
        vm.expectRevert("DC: estate identity mismatch");
        custody.bindLife(victim, 5);
        custody.bindLife(victim, 4);
        vm.stopPrank();
        assertEq(custody.lifeState(victim).wallet, alice);
        assertEq(custody.lifeState(heir).wallet, alice);
        bytes32 otherVictim = keccak256("other-pending-parent");
        bytes32 otherHeir = keccak256("other-pending-heir");
        vm.startPrank(operator);
        custody.registerPendingLife(otherVictim);
        custody.registerPendingLife(otherHeir);
        custody.recordEstateDeath(otherVictim, otherHeir, _nextSequence(), block.timestamp);
        custody.bindLife(otherVictim, 5);
        vm.expectRevert("DC: estate identity mismatch");
        custody.bindLife(otherHeir, 4);
        custody.bindLife(otherHeir, 5);
        vm.stopPrank();
        assertEq(custody.lifeState(otherHeir).wallet, bob);
    }

    function test_prebound_heir_anchors_unminted_parent_and_estate_chain_retains_one_family() public {
        _mintIdentity(alice, 4);
        bytes32 victim = keccak256("unminted-parent");
        bytes32 heir = keccak256("prebound-heir");
        bytes32 nextHeir = keccak256("next-estate-heir");
        vm.startPrank(operator);
        custody.registerPendingLife(victim);
        custody.registerLife(heir, 4);
        custody.registerPendingLife(nextHeir);
        custody.recordEstateDeath(victim, heir, _nextSequence(), block.timestamp);
        custody.bindLife(victim, 4);
        custody.recordEstateDeath(heir, nextHeir, _nextSequence(), block.timestamp);
        vm.stopPrank();
        assertEq(custody.estateFamilyOf(nextHeir), victim);
        assertEq(custody.estateDynastyOf(victim), 4);
        assertEq(custody.lifeState(nextHeir).dynastyId, 4);
        assertEq(custody.lifeState(nextHeir).wallet, alice);
    }

    function test_unequip_requires_operator_owner_signature_freshness_nonce_and_live_life() public {
        DeedStockAccount vault = _equip();
        CharacterDeedCustody.ExitRequest memory request = _exit();
        bytes memory signature = _signature(ALICE_KEY, custody.hashExit(request));
        vm.prank(alice);
        vm.expectRevert("DC: only operator");
        custody.unequip(request, signature);
        bytes memory badSignature = _signature(0xBAD, custody.hashExit(request));
        vm.prank(operator);
        vm.expectRevert("DC: owner signature");
        custody.unequip(request, badSignature);
        vm.prank(operator);
        custody.unequip(request, signature);
        assertEq(deed.ownerOf(deedId), alice);
        assertEq(custody.exitNonce(A), 1);
        assertTrue(deed.transferLocked(deedId));
        vm.prank(alice);
        vault.withdrawERC20(address(stock), 100 ether);
        assertEq(stock.balanceOf(alice), 100 ether);
        _equip();
        vm.prank(operator);
        vm.expectRevert("DC: exit nonce");
        custody.unequip(request, signature);
        _death(A, B);
        request = _exit();
        vm.prank(operator);
        vm.expectRevert("DC: life not live");
        custody.unequip(request, signature);
    }

    function test_exit_old_future_oversized_and_changed_domain_intents_are_rejected() public {
        _equip();
        CharacterDeedCustody.ExitRequest memory request = _exit();
        bytes memory signature = _signature(ALICE_KEY, custody.hashExit(request));
        vm.warp(block.timestamp + 3 minutes);
        vm.prank(operator);
        vm.expectRevert("DC: exit expired or early");
        custody.unequip(request, signature);
        request = _exit();
        request.issuedAt = block.timestamp + 1;
        vm.prank(operator);
        vm.expectRevert("DC: exit expired or early");
        custody.unequip(request, signature);
        request = _exit();
        request.deadline = request.issuedAt + 6 minutes;
        vm.prank(operator);
        vm.expectRevert("DC: exit TTL");
        custody.unequip(request, signature);
        request = _exit();
        signature = _signature(ALICE_KEY, custody.hashExit(request));
        vm.chainId(block.chainid + 1);
        vm.prank(operator);
        vm.expectRevert("DC: owner signature");
        custody.unequip(request, signature);
    }

    function test_contract_owner_signature_and_rejected_exit_receiver_are_atomic() public {
        CustodyExitWallet wallet = new CustodyExitWallet();
        _mintIdentity(address(wallet), 4);
        bytes32 lifeId = keccak256("contract-owner-life");
        vm.prank(operator);
        address account = custody.registerLife(lifeId, 4);
        vm.startPrank(alice);
        deed.setTransferLock(deedId, false);
        deed.safeTransferFrom(alice, address(wallet), deedId);
        vm.stopPrank();
        vm.startPrank(address(wallet));
        deed.setTransferLock(deedId, false);
        deed.approve(address(custody), deedId);
        custody.equip(lifeId, deedId);
        vm.stopPrank();
        CharacterDeedCustody.ExitRequest memory request =
            CharacterDeedCustody.ExitRequest(lifeId, deedId, 0, block.timestamp, block.timestamp + 1 minutes);
        wallet.setDigest(custody.hashExit(request), true);
        vm.prank(operator);
        vm.expectRevert("receipt rejected");
        custody.unequip(request, "1271-owner-intent");
        assertEq(deed.ownerOf(deedId), account);
        assertEq(custody.exitNonce(lifeId), 0);
        assertTrue(deed.transferLocked(deedId));
        wallet.setDigest(custody.hashExit(request), false);
        vm.prank(operator);
        custody.unequip(request, "1271-owner-intent");
        assertEq(deed.ownerOf(deedId), address(wallet));
        assertEq(custody.exitNonce(lifeId), 1);
    }

    function test_alternate_registry_salt_account_is_not_canonical() public {
        address alternate = registry.createAccount(
            custody.accountImplementation(), keccak256("alternate-salt"), block.chainid, address(deed), deedId
        );
        stock.mint(alternate, 100);
        vm.prank(alice);
        vm.expectRevert("DSA: noncanonical account");
        DeedStockAccount(payable(alternate)).withdrawERC20(address(stock), 1);
        assertEq(stock.balanceOf(alternate), 100);
        assertTrue(alternate != custody.deedVault(deedId));
    }

    function test_max_hops_is_bounded_and_long_chain_can_make_finite_partial_progress() public {
        _equip();
        bytes32 previous = A;
        bytes32 thirtySecond;
        bytes32 last;
        for (uint256 i = 1; i <= 34; i++) {
            last = keccak256(abi.encode("chain", i));
            vm.prank(operator);
            custody.registerPendingLife(last);
            _death(previous, last);
            previous = last;
            if (i == 32) thirtySecond = last;
        }
        vm.expectRevert("DC: invalid hops");
        custody.settleDeed(deedId, 0);
        vm.expectRevert("DC: invalid hops");
        custody.settleDeed(deedId, 33);
        assertEq(custody.settleDeed(deedId, 32), thirtySecond);
        assertEq(custody.settleDeed(deedId, 32), last);
        assertEq(deed.ownerOf(deedId), custody.accountOf(last));
    }

    function testFuzz_death_chain_moves_only_to_recorded_successor_preserving_stock(uint8 lengthSeed, uint8 hopSeed)
        public
    {
        DeedStockAccount vault = _equip();
        uint256 length = uint256(lengthSeed) % 12 + 1;
        uint256 hops = uint256(hopSeed) % 32 + 1;
        bytes32[] memory chain = new bytes32[](length + 1);
        chain[0] = A;
        for (uint256 i = 1; i <= length; i++) {
            chain[i] = keccak256(abi.encode("fuzz-chain", i));
            vm.prank(operator);
            custody.registerPendingLife(chain[i]);
            _death(chain[i - 1], chain[i]);
        }
        uint256 cursor;
        while (cursor < length) {
            cursor = cursor + hops < length ? cursor + hops : length;
            assertEq(custody.settleDeed(deedId, hops), chain[cursor]);
            assertEq(deed.ownerOf(deedId), custody.accountOf(chain[cursor]));
            assertEq(stock.balanceOf(address(vault)), 100 ether);
            assertTrue(deed.transferLocked(deedId));
        }
    }
}

contract CharacterDeedCustodyHandler is Test {
    CharacterDeedCustody public immutable custody;
    StreetDeed public immutable deed;
    CustodyStock public immutable stock;
    address public immutable vault;
    uint256 public immutable deedId;
    bytes32[6] public lives;
    bool[6] public dead;
    uint256[6] public successor; // index + 1; zero is frozen non-player estate.
    uint256[6] public releaseAt;
    bool[6] public hasEstateParent;
    uint256 public current;
    uint256 public deaths;

    constructor(CharacterDeedCustody custody_, CustodyStock stock_, uint256 id_, bytes32[6] memory lives_) {
        custody = custody_;
        deed = custody_.deed();
        stock = stock_;
        deedId = id_;
        vault = custody_.deedVault(id_);
        lives = lives_;
    }

    function death(uint256 victimSeed, uint256 killerSeed) public {
        uint256 victim = victimSeed % 6;
        uint256 killer = killerSeed % 7;
        if (dead[victim] || killer == 6 || killer == victim || dead[killer]) return;
        bytes32 heir = keccak256(abi.encode("handler-heir", lives[victim]));
        custody.registerPendingLife(heir);
        custody.recordDeath(lives[victim], lives[killer], heir, deaths + 1, block.timestamp);
        dead[victim] = true;
        successor[victim] = killer + 1;
        ++deaths;
    }

    function estate(uint256 victimSeed, uint256 heirSeed) public {
        uint256 victim = victimSeed % 6;
        uint256 heir = heirSeed % 3 + 3;
        if (dead[victim] || dead[heir] || victim == heir || hasEstateParent[heir]) return;
        custody.recordEstateDeath(lives[victim], lives[heir], deaths + 1, block.timestamp);
        dead[victim] = true;
        successor[victim] = heir + 1;
        releaseAt[victim] = block.timestamp + 24 hours;
        hasEstateParent[heir] = true;
        ++deaths;
    }

    function advanceTime(uint32 elapsed) public {
        vm.warp(block.timestamp + uint256(elapsed) % (2 days));
    }

    function settle(uint256 hopsSeed) public {
        uint256 hops = hopsSeed % 32 + 1;
        if (!dead[current] || successor[current] == 0 || block.timestamp < releaseAt[current]) return;
        uint256 expected = current;
        for (
            uint256 i;
            i < hops && dead[expected] && successor[expected] != 0 && block.timestamp >= releaseAt[expected];
            i++
        ) {
            expected =
                successor[expected] - 1;
        }
        assertEq(custody.settleDeed(deedId, hops), lives[expected]);
        current = expected;
    }

    function attemptBypass(uint256 callerSeed) public {
        address caller = callerSeed % 2 == 0 ? address(0xBAD) : custody.accountOf(lives[current]);
        vm.prank(caller);
        (bool withdrawn,) = vault.call(abi.encodeCall(DeedStockAccount.withdrawERC20, (address(stock), 1)));
        assertFalse(withdrawn);
        (bool executed,) = custody.accountOf(lives[current])
            .call(
                abi.encodeWithSignature(
                    "execute(address,uint256,bytes,uint8)", address(deed), 0, abi.encodeCall(deed.redeem, (deedId)), 0
                )
            );
        assertFalse(executed);
    }

    function attemptUnsignedExit() public {
        CharacterDeedCustody.ExitRequest memory request = CharacterDeedCustody.ExitRequest(
            lives[current], deedId, custody.exitNonce(lives[current]), block.timestamp, block.timestamp + 1 minutes
        );
        (bool exited,) = address(custody).call(abi.encodeCall(custody.unequip, (request, bytes("unsigned"))));
        assertFalse(exited);
    }

    function assertModel() external view {
        assertEq(custody.deathSequence(), deaths);
        assertEq(deed.ownerOf(deedId), custody.accountOf(lives[current]));
        assertEq(custody.equippedLife(deedId), lives[current]);
        assertEq(stock.balanceOf(vault), 100 ether);
        assertTrue(deed.transferLocked(deedId));
        for (uint256 i; i < 6; i++) {
            CharacterDeedCustody.Life memory life = custody.lifeState(lives[i]);
            assertEq(life.dead, dead[i]);
            assertEq(custody.estateReleaseAt(lives[i]), dead[i] ? custody.lifeState(lives[i]).deathAt + 24 hours : 0);
            assertEq(life.killer, successor[i] == 0 ? bytes32(0) : lives[successor[i] - 1]);
            if (dead[i] && successor[i] != 0) {
                CharacterDeedCustody.Life memory next = custody.lifeState(life.killer);
                assertTrue(!next.dead || next.deathSequence > life.deathSequence);
            }
        }
    }
}

contract CharacterDeedCustodyInvariantTest is StdInvariant, CharacterDeedCustodyFixture {
    CharacterDeedCustodyHandler handler;

    function setUp() public override {
        super.setUp();
        _equip();
        bytes32[6] memory lives = [A, B, C, keccak256("pending-d"), keccak256("pending-e"), keccak256("pending-f")];
        vm.startPrank(operator);
        for (uint256 i = 3; i < 6; i++) {
            custody.registerPendingLife(lives[i]);
        }
        vm.stopPrank();
        handler = new CharacterDeedCustodyHandler(custody, stock, deedId, lives);
        vm.prank(safe);
        custody.setLifecycleOperator(address(handler));
        handler.death(0, 1);
        handler.death(1, 2);
        handler.estate(2, 0);
        handler.settle(0);
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = handler.death.selector;
        selectors[1] = handler.settle.selector;
        selectors[2] = handler.attemptBypass.selector;
        selectors[3] = handler.attemptUnsignedExit.selector;
        selectors[4] = handler.estate.selector;
        selectors[5] = handler.advanceTime.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector(address(handler), selectors));
    }

    /// forge-config: default.invariant.depth = 64
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_deed_stock_lock_and_successor_graph_match_independent_model() public view {
        handler.assertModel();
    }
}

/// @dev Independent linear interval model cross-checks the contract's historical binary search.
contract SafeHouseCoverageHandler is Test {
    CharacterDeedCustody public immutable custody;
    OmertaRestrictedOMRV2 public immutable omr;
    uint256 public immutable deedId;
    bytes32 public immutable life;
    uint256 public expectedSupply;
    uint256 public expectedBurn;
    uint256 public expectedNonce;
    uint256[] private starts;
    uint256[] private ends;

    constructor(CharacterDeedCustody custody_, OmertaRestrictedOMRV2 omr_, uint256 deedId_, bytes32 life_) {
        custody = custody_; omr = omr_; deedId = deedId_; life = life_; expectedSupply = omr_.totalSupply();
    }

    function advance(uint32 seconds_) external { vm.warp(block.timestamp + uint256(seconds_) % (3 days)); }

    function renew(uint8 daysSeed) external {
        uint256 days_ = uint256(daysSeed) % 7 + 1;
        (uint256 day,,uint256 price) = custody.safeHouseQuote();
        uint256 start = block.timestamp + 1;
        uint256 until = starts.length != 0 && ends[ends.length - 1] >= start
            ? ends[ends.length - 1] + days_ * 1 days : start + days_ * 1 days;
        address wallet = vm.addr(0xA11CE);
        if (until > block.timestamp + 1 + 7 days || omr.balanceOf(wallet) < price * days_) return;
        CharacterDeedCustody.SafeHouseRequest memory request = CharacterDeedCustody.SafeHouseRequest(
            life, deedId, days_, day, price * days_, expectedNonce, block.timestamp, block.timestamp + 1 minutes
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xA11CE, custody.hashSafeHouse(request));
        custody.prepaySafeHouse(request, abi.encodePacked(r,s,v));
        if (starts.length != 0 && ends[ends.length - 1] >= start) ends[ends.length - 1] = until;
        else { starts.push(start); ends.push(until); }
        ++expectedNonce; expectedBurn += price * days_;
    }

    function query(uint64 sample) public view {
        uint256 timestamp = 100 days + uint256(sample) % (block.timestamp - 100 days + 8 days);
        bool covered;
        for (uint256 i; i < starts.length; ++i) {
            if (starts[i] <= timestamp && timestamp < ends[i]) covered = true;
        }
        assertEq(custody.safeHouseCoveredAt(deedId, 1, timestamp), covered);
        assertFalse(custody.safeHouseCoveredAt(deedId, 2, timestamp));
    }

    function assertModel() external view {
        assertEq(omr.totalSupply(), expectedSupply - expectedBurn);
        assertEq(omr.balanceOf(address(custody)), 0);
        assertEq(custody.safeHouseNonce(life), expectedNonce);
        assertEq(custody.safeHouseUntil(deedId, 1), ends.length == 0 ? 0 : ends[ends.length - 1]);
        query(uint64(block.timestamp));
    }
}

contract SafeHouseCoverageInvariantTest is StdInvariant, CharacterDeedCustodyFixture {
    SafeHouseCoverageHandler handler;
    function setUp() public override {
        super.setUp(); _equip();
        handler = new SafeHouseCoverageHandler(custody, omr, deedId, A);
        vm.prank(safe); custody.setLifecycleOperator(address(handler));
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = handler.advance.selector; selectors[1] = handler.renew.selector; selectors[2] = handler.query.selector;
        targetContract(address(handler)); targetSelector(FuzzSelector(address(handler), selectors));
    }
    /// forge-config: default.invariant.depth = 64
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_historical_coverage_matches_linear_model_and_every_period_reduces_supply() public view {
        handler.assertModel();
    }
}
