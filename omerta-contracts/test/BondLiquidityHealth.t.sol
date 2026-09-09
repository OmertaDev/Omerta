// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {OMR} from "../src/OMR.sol";
import {OmertaBond} from "../src/OmertaBond.sol";
import {IOmrOracle} from "../src/IOmrOracle.sol";
import {ILiquidityHealth} from "../src/interfaces/ILiquidityHealth.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract BondLiquidityOracle is IOmrOracle {
    uint256 public price = 1000 ether;
    uint256 public updatedAt = block.timestamp;
    function set(uint256 value, uint256 timestamp) external { price = value; updatedAt = timestamp; }
    function consult() external view returns (uint256, uint256) { return (price, updatedAt); }
}

contract BondLiquidityGuard is ILiquidityHealth {
    bool public ok = true;
    bool public broken;
    function set(bool ok_, bool broken_) external { ok = ok_; broken = broken_; }
    function healthy() external view returns (bool) { require(!broken, "guard failed"); return ok; }
}

contract BondMalformedLiquidityGuard {}

contract BondLiquidityHealthTest is Test {
    uint256 internal constant SIGNER_KEY = 0xB017D;
    address internal constant PAYER = address(0xA11CE);
    address internal constant GUARDIAN = address(0x600D);
    address payable internal constant POL = payable(address(0xD001));
    address payable internal constant DEV = payable(address(0xD002));
    address payable internal constant RWA = payable(address(0xD003));
    address payable internal constant VIG = payable(address(0xD004));
    OMR internal omr;
    OmertaBond internal bond;
    BondLiquidityOracle internal oracle;
    BondLiquidityGuard internal guard;

    function setUp() public {
        vm.warp(1_000_000);
        omr = new OMR(address(this));
        oracle = new BondLiquidityOracle();
        guard = new BondLiquidityGuard();
        bond = _newBond(true);
        vm.deal(PAYER, 10 ether);
    }

    function _newBond(bool guarded) internal returns (OmertaBond result) {
        result = new OmertaBond(address(this), vm.addr(SIGNER_KEY), IERC20(address(omr)),
            5000, 2000, 1000, POL, DEV, RWA, VIG, 100_000 ether, 10_000 ether);
        result.setOracle(oracle, 0, 3600);
        if (guarded) result.setLiquidityHealthGuard(guard);
        result.setEmergencyGuardian(GUARDIAN);
        omr.setMinter(address(result));
    }

    function _quote(uint256 nonce) internal view returns (OmertaBond.BondQuote memory) {
        return OmertaBond.BondQuote(PAYER, 1 ether, 1000 ether, 0, 1 days, nonce, block.timestamp + 1 days);
    }

    /// @dev Independent EIP-712 encoding, without asking the target for its quote digest.
    function _sign(OmertaBond target, OmertaBond.BondQuote memory q) internal view returns (bytes memory) {
        bytes32 domain = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("OmertaBond"), keccak256("1"), block.chainid, address(target)));
        bytes32 body = keccak256(abi.encode(
            keccak256("BondQuote(address payer,uint256 principal,uint256 priceOmrPerEth,uint256 discountBps,uint256 vestSeconds,uint256 nonce,uint256 deadline)"),
            q.payer, q.principal, q.priceOmrPerEth, q.discountBps, q.vestSeconds, q.nonce, q.deadline));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, keccak256(abi.encodePacked(hex"1901", domain, body)));
        return abi.encodePacked(r, s, v);
    }

    function _open(uint256 nonce) internal returns (uint256 id) {
        OmertaBond.BondQuote memory q = _quote(nonce);
        bytes memory sig = _sign(bond, q);
        vm.prank(PAYER);
        return bond.bond{value: q.principal}(q, sig);
    }

    function _assertNotConsumed(uint256 nonce, uint256 supplyBefore) internal view {
        assertFalse(bond.usedNonce(nonce));
        assertEq(bond.committedOMR(), 0);
        assertEq(omr.totalSupply(), supplyBefore);
        assertEq(omr.balanceOf(address(bond)), 0);
        assertEq(PAYER.balance, 10 ether);
        assertEq(POL.balance + DEV.balance + RWA.balance + VIG.balance, 0);
    }

    function test_preSignedQuoteCannotExecuteAfterLiquidityBecomesUnhealthy() public {
        OmertaBond.BondQuote memory q = _quote(1);
        bytes memory sig = _sign(bond, q);
        uint256 beforeSupply = omr.totalSupply();
        assertTrue(bond.liquidityHealthy());
        guard.set(false, false);
        assertFalse(bond.liquidityHealthy());
        vm.prank(PAYER);
        vm.expectRevert(OmertaBond.LiquidityUnhealthy.selector);
        bond.bond{value: q.principal}(q, sig);
        _assertNotConsumed(1, beforeSupply);
        guard.set(true, false);
        vm.prank(PAYER);
        bond.bond{value: q.principal}(q, sig);
        assertTrue(bond.usedNonce(1));
        assertEq(bond.committedOMR(), 1000 ether);
    }

    function test_guardRevertAndMissingHealthySelectorFailClosed() public {
        guard.set(true, true);
        vm.expectRevert(OmertaBond.LiquidityUnhealthy.selector);
        bond.priceCeiling();
        bond.pause();
        bond.setLiquidityHealthGuard(ILiquidityHealth(address(new BondMalformedLiquidityGuard())));
        bond.unpause();
        assertFalse(bond.liquidityHealthy());
        OmertaBond.BondQuote memory q = _quote(2);
        bytes memory sig = _sign(bond, q);
        vm.prank(PAYER);
        vm.expectRevert(OmertaBond.LiquidityUnhealthy.selector);
        bond.bond{value: q.principal}(q, sig);
        assertFalse(bond.usedNonce(2));
    }

    function test_preSignedQuoteCannotExecuteAfterEmergencyPause() public {
        OmertaBond.BondQuote memory q = _quote(3);
        bytes memory sig = _sign(bond, q);
        uint256 beforeSupply = omr.totalSupply();
        vm.prank(GUARDIAN);
        bond.emergencyPause();
        assertTrue(bond.paused());
        vm.prank(PAYER);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        bond.bond{value: q.principal}(q, sig);
        _assertNotConsumed(3, beforeSupply);
    }

    function test_vestedClaimsRemainAvailableWhilePausedGuardBrokenAndOracleStale() public {
        uint256 id = _open(4);
        guard.set(false, true);
        vm.prank(GUARDIAN);
        bond.emergencyPause();
        vm.warp(block.timestamp + 12 hours);
        vm.prank(PAYER);
        assertEq(bond.claim(id), 500 ether);
        assertEq(omr.balanceOf(PAYER), 500 ether);
        assertEq(bond.committedOMR(), 500 ether);
        vm.warp(block.timestamp + 12 hours);
        vm.prank(PAYER);
        assertEq(bond.claim(id), 500 ether);
        assertEq(bond.committedOMR(), 0);
        assertEq(omr.balanceOf(PAYER), 1000 ether);
        assertEq(omr.balanceOf(address(bond)), 0);
    }

    function test_installedGuardCannotBeZeroedAndReplacementRequiresPause() public {
        BondLiquidityGuard next = new BondLiquidityGuard();
        vm.expectRevert(OmertaBond.InvalidHealthGuard.selector);
        bond.setLiquidityHealthGuard(ILiquidityHealth(address(0)));
        vm.expectRevert(OmertaBond.InvalidHealthGuard.selector);
        bond.setLiquidityHealthGuard(next);
        bond.pause();
        vm.expectRevert(OmertaBond.InvalidHealthGuard.selector);
        bond.setLiquidityHealthGuard(ILiquidityHealth(address(0)));
        vm.expectRevert(OmertaBond.InvalidHealthGuard.selector);
        bond.setLiquidityHealthGuard(ILiquidityHealth(PAYER));
        bond.setLiquidityHealthGuard(next);
        assertEq(address(bond.liquidityHealthGuard()), address(next));
        bond.unpause();
        assertTrue(bond.liquidityHealthy());
    }

    function test_guardianCanOnlyPauseAndRotationRevokesOldGuardian() public {
        vm.startPrank(PAYER);
        vm.expectRevert(OmertaBond.NotEmergencyGuardian.selector);
        bond.emergencyPause();
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, PAYER));
        bond.setEmergencyGuardian(PAYER);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, PAYER));
        bond.setLiquidityHealthGuard(guard);
        vm.stopPrank();
        vm.prank(GUARDIAN);
        bond.emergencyPause();
        vm.prank(GUARDIAN);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, GUARDIAN));
        bond.unpause();
        bond.unpause();
        bond.setEmergencyGuardian(PAYER);
        vm.prank(GUARDIAN);
        vm.expectRevert(OmertaBond.NotEmergencyGuardian.selector);
        bond.emergencyPause();
        vm.prank(PAYER);
        bond.emergencyPause();
    }

    function test_firstGuardInstallationIsExplicitAndLegacyModeDoesNotClaimHealthy() public {
        bond = _newBond(false);
        assertFalse(bond.liquidityHealthy());
        assertEq(address(bond.liquidityHealthGuard()), address(0));
        // The upgrade preserves the legacy unguarded rail until governance explicitly installs it.
        (uint256 ceiling,) = bond.priceCeiling();
        assertEq(ceiling, 1000 ether);
        bond.setLiquidityHealthGuard(guard);
        guard.set(false, false);
        vm.expectRevert(OmertaBond.LiquidityUnhealthy.selector);
        bond.priceCeiling();
    }

    function testFuzz_futureOracleTimestampIsRejectedWithOrWithoutGuard(uint64 offsetSeed, bool guarded) public {
        bond = _newBond(guarded);
        uint256 offset = bound(offsetSeed, 1, 365 days);
        oracle.set(1000 ether, block.timestamp + offset);
        OmertaBond.BondQuote memory q = _quote(5);
        bytes memory sig = _sign(bond, q);
        uint256 beforeSupply = omr.totalSupply();
        vm.expectRevert(OmertaBond.OracleUnavailable.selector);
        bond.priceCeiling();
        vm.prank(PAYER);
        vm.expectRevert(OmertaBond.OracleUnavailable.selector);
        bond.bond{value: q.principal}(q, sig);
        _assertNotConsumed(5, beforeSupply);
    }

    function test_oracleAgeBoundaryIsInclusiveAndMaximumFutureValueIsRejected() public {
        oracle.set(1000 ether, block.timestamp - 3600);
        (uint256 ceiling,) = bond.priceCeiling();
        assertEq(ceiling, 1000 ether);
        oracle.set(1000 ether, block.timestamp - 3601);
        vm.expectRevert(abi.encodeWithSelector(OmertaBond.OracleStale.selector, block.timestamp - 3601, 3600));
        bond.priceCeiling();
        oracle.set(1000 ether, type(uint256).max);
        vm.expectRevert(OmertaBond.OracleUnavailable.selector);
        bond.priceCeiling();
    }
}
