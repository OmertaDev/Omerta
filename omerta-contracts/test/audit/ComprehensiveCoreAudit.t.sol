// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {PoolManager} from "v4-core/PoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {OMR} from "../../src/OMR.sol";
import {OMRStaking} from "../../src/OMRStaking.sol";
import {OmertaBond} from "../../src/OmertaBond.sol";
import {GenesisOracle} from "../../src/GenesisOracle.sol";
import {GenesisProceedsSplitter} from "../../src/GenesisProceedsSplitter.sol";
import {VoucherClaim, IGearVault} from "../../src/VoucherClaim.sol";
import {GearVault} from "../../src/GearVault.sol";
import {StreetDeed} from "../../src/StreetDeed.sol";
import {StockVault} from "../../src/StockVault.sol";

contract CoreAuditRejectEth {
    receive() external payable { revert("reject ETH"); }
}

contract CoreAuditBurnGearReceiver is ERC1155Holder {
    GearVault public immutable gear;
    constructor(GearVault gear_) { gear = gear_; }
    function onERC1155Received(address, address, uint256 id, uint256 value, bytes memory)
        public override returns (bytes4)
    {
        require(msg.sender == address(gear));
        gear.redeem(id, value);
        return this.onERC1155Received.selector;
    }
}

contract CoreAuditBurnDeedReceiver is IERC721Receiver {
    StreetDeed public immutable deed;
    constructor(StreetDeed deed_) { deed = deed_; }
    function onERC721Received(address, address, uint256 id, bytes calldata) external returns (bytes4) {
        require(msg.sender == address(deed));
        deed.redeem(id);
        return this.onERC721Received.selector;
    }
}

/// @dev Intentionally hostile external token; does not stand in for a supported production asset.
contract CoreAuditFalseReturnToken {
    function transfer(address, uint256) external pure returns (bool) { return false; }
}

/// @notice Supplementary independent audit evidence, 2026-09-08. Actual in-scope OMR and vault
/// implementations are used; adversarial receiver/token fixtures are explicitly named.
contract ComprehensiveCoreAuditTest is Test {
    using PoolIdLibrary for PoolKey;

    uint256 private constant SIGNING_KEY = 0xC0AEA001;
    address private safe = makeAddr("core-audit-safe");
    address private alice = makeAddr("core-audit-alice");
    address private bob = makeAddr("core-audit-bob");
    address payable private dev = payable(makeAddr("core-audit-dev"));
    address payable private vig = payable(makeAddr("core-audit-vig"));
    address payable private pol = payable(makeAddr("core-audit-pol"));
    OMR private omr;

    function setUp() public {
        vm.warp(1_800_000_000);
        omr = new OMR(safe);
    }

    function _sign(bytes32 digest) private pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNING_KEY, digest);
        return abi.encodePacked(r, s, v);
    }

    function _typedDigest(string memory name, address target, bytes32 message) private view returns (bytes32) {
        bytes32 domain = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(name)), keccak256("1"), block.chainid, target
        ));
        return keccak256(abi.encodePacked(hex"1901", domain, message));
    }

    function _newBond(address payable vig_) private returns (OmertaBond b) {
        b = new OmertaBond(safe, vm.addr(SIGNING_KEY), IERC20(address(omr)), 7500, 1500, 500,
            pol, dev, payable(safe), vig_, 1_000_000e18, 2_000e18);
        GenesisOracle feed = new GenesisOracle(safe, 1_000e18, block.timestamp + 30 days);
        vm.startPrank(safe);
        b.setOracle(feed, 0, 1 hours);
        omr.setMinter(address(b));
        vm.stopPrank();
    }

    function _bondQuote(uint256 principal, uint256 discount) private view returns (OmertaBond.BondQuote memory q) {
        q = OmertaBond.BondQuote(alice, principal, 1_000e18, discount, 14 days, 1, block.timestamp + 1 hours);
    }

    function _bondSignature(OmertaBond b, OmertaBond.BondQuote memory q) private view returns (bytes memory) {
        return _sign(_typedDigest("OmertaBond", address(b), keccak256(abi.encode(
            keccak256("BondQuote(address payer,uint256 principal,uint256 priceOmrPerEth,uint256 discountBps,uint256 vestSeconds,uint256 nonce,uint256 deadline)"),
            q.payer, q.principal, q.priceOmrPerEth, q.discountBps, q.vestSeconds, q.nonce, q.deadline
        ))));
    }

    function _newGearBridge(GearVault gear) private returns (VoucherClaim vc) {
        vc = new VoucherClaim(safe, vm.addr(SIGNING_KEY), IERC20(address(omr)), IGearVault(address(gear)), 1000e18);
        vm.startPrank(safe);
        gear.setMinter(address(vc));
        vc.setGearSupplyCap(100032, 2);
        vm.stopPrank();
    }

    function _gearVoucher(VoucherClaim vc, address to, uint256 qty, uint256 nonce)
        private view returns (VoucherClaim.Voucher memory v, bytes memory sig)
    {
        v = VoucherClaim.Voucher(to, qty, 1, 100032, nonce, block.timestamp + 1 hours);
        sig = _sign(_typedDigest("OmertaVoucherClaim", address(vc), keccak256(abi.encode(
            keccak256("Voucher(address to,uint256 amount,uint8 kind,uint256 gearId,uint256 nonce,uint256 deadline)"),
            v.to, v.amount, v.kind, v.gearId, v.nonce, v.deadline
        ))));
    }

    function testFuzz_stakingRateHistoryAndCheckpointsCannotOverpay(
        uint96 principalSeed, uint32[8] memory intervals, uint16[8] memory rates
    ) public {
        uint256 principal = bound(uint256(principalSeed), 1e18, 1_000_000e18);
        OMRStaking staking = new OMRStaking(safe, IERC20(address(omr)), 0);
        vm.startPrank(safe);
        omr.transfer(alice, principal);
        omr.approve(address(staking), 10_000_000e18);
        staking.fundRewards(10_000_000e18);
        vm.stopPrank();
        vm.startPrank(alice);
        omr.approve(address(staking), principal);
        staking.stake(principal);
        vm.stopPrank();

        uint256 exactScaledInterest;
        for (uint256 i; i < 8; ++i) {
            uint256 rate = bound(uint256(rates[i]), 0, 5000);
            uint256 dt = bound(uint256(intervals[i]), 1, 30 days);
            vm.prank(safe);
            staking.setApy(rate);
            vm.warp(block.timestamp + dt);
            exactScaledInterest += principal * rate * dt;
        }
        uint256 expectedFloor = exactScaledInterest / (10000 * 365 days);
        uint256 pending = staking.pendingRewards(alice);
        assertLe(pending, expectedFloor, "checkpoint arithmetic overpaid the rate history");
        assertLe(expectedFloor - pending, 8 * principal / 1e18 + 1, "loss exceeds index rounding bound");

        vm.startPrank(alice);
        staking.unstake(principal);
        if (pending != 0) staking.claimRewards();
        vm.stopPrank();
        assertEq(omr.balanceOf(alice), principal + pending);
        assertEq(staking.totalStaked(), 0);
        assertEq(omr.balanceOf(address(staking)), staking.rewardPool());
    }

    function testFuzz_repeatedBondClaimsConserveMintedCommitment(
        uint96 principalSeed, uint16 discountSeed, uint32[8] memory intervals
    ) public {
        uint256 principal = bound(uint256(principalSeed), 1 gwei, 10 ether);
        uint256 discount = bound(uint256(discountSeed), 0, 2000);
        OmertaBond b = _newBond(vig);
        OmertaBond.BondQuote memory q = _bondQuote(principal, discount);
        uint256 supplyBefore = omr.totalSupply();
        vm.deal(alice, principal);
        bytes memory sig = _bondSignature(b, q);
        vm.prank(alice);
        uint256 id = b.bond{value: principal}(q, sig);
        uint256 payout = ((principal * 1000e18 / 1e18) * 10000) / (10000 - discount);
        uint256 totalClaimed;
        uint256 start = block.timestamp;
        for (uint256 i; i < 8; ++i) {
            vm.warp(block.timestamp + bound(uint256(intervals[i]), 0, 3 days));
            uint256 claimable = b.claimable(id);
            if (claimable != 0) {
                vm.prank(alice);
                totalClaimed += b.claim(id);
            }
            assertEq(totalClaimed + b.committedOMR(), payout);
            assertEq(omr.balanceOf(address(b)), b.committedOMR());
        }
        if (block.timestamp < start + 14 days) vm.warp(start + 14 days);
        if (b.claimable(id) != 0) {
            vm.prank(alice);
            totalClaimed += b.claim(id);
        }
        assertEq(totalClaimed, payout);
        assertEq(omr.balanceOf(alice), payout);
        assertEq(omr.totalSupply() - supplyBefore, payout);
        assertEq(b.committedOMR(), 0);
        assertEq(address(b).balance, 0);
    }

    function test_lastBondRecipientFailureRollsBackEarlierPaymentsAndMint() public {
        OmertaBond b = _newBond(payable(address(new CoreAuditRejectEth())));
        OmertaBond.BondQuote memory q = _bondQuote(1 ether, 800);
        bytes memory sig = _bondSignature(b, q);
        uint256 supplyBefore = omr.totalSupply();
        vm.deal(alice, 1 ether);
        vm.expectRevert(OmertaBond.ForwardFailed.selector);
        vm.prank(alice);
        b.bond{value: 1 ether}(q, sig);
        assertEq(alice.balance, 1 ether);
        assertEq(dev.balance + pol.balance + safe.balance, 0);
        assertEq(omr.totalSupply(), supplyBefore);
        assertEq(b.committedOMR(), 0);
        assertEq(b.bondedOnDay(block.timestamp / 1 days), 0);
        assertEq(b.nextBondId(), 1);
        assertFalse(b.usedNonce(1));
    }

    function test_gearBurnDuringMintConservesSupplyAndExposesActualLogOrder() public {
        GearVault gear = new GearVault(safe, "ipfs://audit/");
        vm.prank(safe);
        gear.setGearCap(100032, 2);
        VoucherClaim vc = _newGearBridge(gear);
        CoreAuditBurnGearReceiver receiver = new CoreAuditBurnGearReceiver(gear);
        (VoucherClaim.Voucher memory v, bytes memory sig) = _gearVoucher(vc, address(receiver), 1, 11);
        vm.recordLogs();
        vc.claim(v, sig);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(gear.minted(100032), 1);
        assertEq(gear.redeemed(100032), 1);
        assertEq(gear.balanceOf(address(receiver), 100032), 0);
        assertEq(logs[2].topics[0], keccak256("Redeemed(address,uint256,uint256)"));
        assertEq(logs[3].topics[0], keccak256("Claimed(uint256,address,uint8,uint256,uint256)"));
        vm.expectRevert("VC: replay");
        vc.claim(v, sig);
    }

    function test_realBridgeReplacementCannotReuseAnotherBridgesLiveSupply() public {
        GearVault gear = new GearVault(safe, "ipfs://audit/");
        vm.prank(safe);
        gear.setGearCap(100032, 2);
        VoucherClaim first = _newGearBridge(gear);
        (VoucherClaim.Voucher memory v, bytes memory sig) = _gearVoucher(first, alice, 2, 21);
        first.claim(v, sig);
        vm.prank(alice);
        gear.redeem(100032, 1);
        VoucherClaim second = _newGearBridge(gear);
        (v, sig) = _gearVoucher(second, bob, 1, 22);
        second.claim(v, sig);
        (v, sig) = _gearVoucher(second, bob, 1, 23);
        vm.expectRevert("GearVault: cap");
        second.claim(v, sig);
        assertEq(gear.minted(100032) - gear.redeemed(100032), 2);
        assertEq(gear.balanceOf(alice, 100032) + gear.balanceOf(bob, 100032), 2);
        assertEq(second.gearMinted(100032), 1);
        assertFalse(second.usedNonce(23));
    }

    function test_deedBurnDuringMintClearsOwnershipAndPreservesReplayWall() public {
        StreetDeed deed = new StreetDeed(safe, vm.addr(SIGNING_KEY), "https://plate/", "https://deed/", 10);
        CoreAuditBurnDeedReceiver receiver = new CoreAuditBurnDeedReceiver(deed);
        StreetDeed.DeedVoucher memory v = StreetDeed.DeedVoucher(address(receiver), "Audit Street", "Harbor", 31, block.timestamp + 1 hours);
        bytes memory sig = _sign(_typedDigest("OmertaStreetDeed", address(deed), keccak256(abi.encode(
            keccak256("DeedVoucher(address to,string name,string district,uint256 nonce,uint256 deadline)"),
            v.to, keccak256(bytes(v.name)), keccak256(bytes(v.district)), v.nonce, v.deadline
        ))));
        vm.recordLogs();
        deed.claim(v, sig);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 id = deed.tokenIdFor(v.name);
        assertEq(deed.balanceOf(address(receiver)), 0);
        assertFalse(deed.transferLocked(id));
        assertEq(deed.mintedOnDay(block.timestamp / 1 days), 1);
        assertEq(logs[2].topics[0], keccak256("Redeemed(address,uint256)"));
        assertEq(logs[3].topics[0], keccak256("Extracted(uint256,address,uint256,string,string)"));
        vm.expectRevert();
        deed.ownerOf(id);
        vm.expectRevert("SD: replay");
        deed.claim(v, sig);
    }

    function test_stockAuthorizationBindsDeploymentChainAndDestination() public {
        StockVault vault = new StockVault(safe, alice, 100e18);
        StockVault other = new StockVault(safe, alice, 100e18);
        vm.startPrank(safe);
        vault.setAllocationSigner(vm.addr(SIGNING_KEY));
        other.setAllocationSigner(vm.addr(SIGNING_KEY));
        omr.transfer(address(vault), 100e18);
        omr.transfer(address(other), 100e18);
        vm.stopPrank();
        StockVault.DeliveryAuthorization memory auth = StockVault.DeliveryAuthorization(41, keccak256("epoch"), keccak256("account"), address(omr), bob, 1e18, block.timestamp + 1 hours);
        bytes memory sig = _sign(_typedDigest("OMERTA StockVault", address(vault), keccak256(abi.encode(
            keccak256("DeliveryAuthorization(uint256 deliveryId,bytes32 epochHash,bytes32 accountHash,address token,address to,uint256 units,uint256 deadline)"),
            auth.deliveryId, auth.epochHash, auth.accountHash, auth.token, auth.to, auth.units, auth.deadline
        ))));
        vm.expectRevert("SV: bad authorization");
        vm.prank(alice);
        other.deliverAuthorized(auth, sig);
        uint256 originalChain = block.chainid;
        vm.chainId(originalChain + 1);
        vm.expectRevert("SV: bad authorization");
        vm.prank(alice);
        vault.deliverAuthorized(auth, sig);
        vm.chainId(originalChain);
        auth.to = alice;
        vm.expectRevert("SV: bad authorization");
        vm.prank(alice);
        vault.deliverAuthorized(auth, sig);
        auth.to = bob;
        vm.prank(alice);
        vault.deliverAuthorized(auth, sig);
        assertEq(omr.balanceOf(bob), 1e18);
        assertFalse(other.usedDeliveryId(41));
        assertEq(vault.deliveredOnDay(address(omr), block.timestamp / 1 days), 1e18);
    }

    function test_failedStockTransferRestoresIdAndDailyCapacity() public {
        StockVault vault = new StockVault(safe, alice, 100e18);
        CoreAuditFalseReturnToken token = new CoreAuditFalseReturnToken();
        vm.expectRevert();
        vm.prank(alice);
        vault.deliver(51, address(token), bob, 1e18);
        assertFalse(vault.usedDeliveryId(51));
        assertEq(vault.deliveredOnDay(address(token), block.timestamp / 1 days), 0);
    }

    function test_genesisFinalRecipientRejectionRevertsEarlierShares() public {
        PoolManager manager = new PoolManager(safe);
        PoolKey memory key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(omr)), 3000, 60, IHooks(address(0)));
        GenesisProceedsSplitter splitter = new GenesisProceedsSplitter(manager, key.toId(), payable(safe), vig,
            payable(address(new CoreAuditRejectEth())));
        manager.initialize(key, 79228162514264337593543950336);
        vm.deal(address(splitter), 10 ether);
        vm.expectRevert();
        splitter.distributeResidual();
        assertEq(address(splitter).balance, 10 ether);
        assertEq(safe.balance + vig.balance, 0);
        // Recovery cannot override the successful-pool branch or redirect the immutable recipients.
        vm.expectRevert(GenesisProceedsSplitter.PoolAlreadyInitialized.selector);
        splitter.recoverFailedLaunch();
    }
}
