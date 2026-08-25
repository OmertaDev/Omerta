// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {Alchemist} from "../../src/Alchemist.sol";
import {CollateralEscrow} from "../../src/CollateralEscrow.sol";
import {Denari} from "../../src/Denari.sol";
import {Transmuter} from "../../src/Transmuter.sol";

interface IMinShareAlchemist {
    function deposit(uint256 assets, uint256 minSharesOut) external;
}

contract AuditUSDC is ERC20 {
    constructor() ERC20("Audit USD Coin", "aUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev The unmodified OpenZeppelin ERC-4626 boundary used for the donation PoC.
contract AuditVault is ERC4626 {
    constructor(IERC20 asset_) ERC4626(asset_) ERC20("Audit Vault", "avUSDC") {}
}

/// @dev A standards-compliant ERC-4626 that charges an exit fee from the owner's gross share value.
///      `convertToAssets` remains fee-exclusive, while both previews include the fee as ERC-4626
///      requires. The fee is transferred out of the vault, making the extra collateral consumption
///      observable rather than redistributing it to the remaining shareholders.
contract AuditExitFeeVault is ERC4626 {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;

    uint16 public immutable exitFeeBps;
    address public immutable exitFeeRecipient;

    error BadExitFee();
    error ExitFeeInvariant();

    constructor(IERC20 asset_, uint16 exitFeeBps_, address exitFeeRecipient_)
        ERC4626(asset_)
        ERC20("Audit Exit-Fee Vault", "aefUSDC")
    {
        if (exitFeeBps_ >= BPS || exitFeeRecipient_ == address(0)) revert BadExitFee();
        exitFeeBps = exitFeeBps_;
        exitFeeRecipient = exitFeeRecipient_;
    }

    function earn(uint256 assets) external {
        AuditUSDC(asset()).mint(address(this), assets);
    }

    /// @notice Shares burned include enough gross value to pay `assets` plus the exit fee.
    function previewWithdraw(uint256 assets) public view override returns (uint256) {
        uint256 grossAssets = Math.mulDiv(assets, BPS, BPS - exitFeeBps, Math.Rounding.Ceil);
        return _convertToShares(grossAssets, Math.Rounding.Ceil);
    }

    /// @notice Assets returned exclude the exit fee charged against the shares' gross value.
    function previewRedeem(uint256 shares) public view override returns (uint256) {
        uint256 grossAssets = _convertToAssets(shares, Math.Rounding.Floor);
        uint256 fee = Math.mulDiv(grossAssets, exitFeeBps, BPS, Math.Rounding.Ceil);
        return grossAssets - fee;
    }

    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
    {
        uint256 grossAssets = _convertToAssets(shares, Math.Rounding.Floor);
        if (grossAssets < assets) revert ExitFeeInvariant();
        uint256 fee = grossAssets - assets;

        super._withdraw(caller, receiver, owner, assets, shares);
        if (fee != 0) IERC20(asset()).safeTransfer(exitFeeRecipient, fee);
    }
}

contract AlchemistRedTeamTest is Test {
    uint256 private constant M = 1e6;

    address private constant SAFE = address(0x5AFE);
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant ATTACKER = address(0xBAD);
    address private constant VICTIM_ONE = address(0x1001);
    address private constant VICTIM_TWO = address(0x1002);
    address private constant VICTIM_THREE = address(0x1003);
    address private constant PROTOCOL_FEE_RECIPIENT = address(0xFEE1);
    address private constant VAULT_FEE_RECIPIENT = address(0xFEE2);

    AuditUSDC private usdc;

    function setUp() public {
        usdc = new AuditUSDC();
        vm.roll(1_000);
    }

    /// @dev Mutation check: this PoC stops succeeding once `mint` includes `debtAmount` in the
    ///      reserve-floor requirement rather than checking only the old total supply.
    function test_regression_mint_cannot_break_the_post_issuance_buffer_floor() public {
        AuditVault vault = new AuditVault(IERC20(address(usdc)));
        (Denari dnr, Transmuter transmuter, Alchemist alchemist) = _deployMarket(IERC4626(address(vault)), 20_000 * M);

        _fundAndApprove(ALICE, alchemist, 400_000 * M);
        vm.prank(ALICE);
        alchemist.deposit(400_000 * M, 1);
        vm.roll(block.number + 1);

        vm.prank(ALICE);
        alchemist.mint(100_000 ether);
        assertEq(transmuter.requiredBuffer(), 20_000 * M, "first mint reaches the exact reserve floor");
        assertTrue(transmuter.bufferHealthy(), "the exact-floor state is healthy before the next mint");

        vm.prank(ALICE);
        vm.expectRevert(Alchemist.BufferUnhealthy.selector);
        alchemist.mint(100_000 ether);

        assertEq(dnr.totalSupply(), 100_000 ether, "a rejected mint changed total supply");
        assertEq(alchemist.debtOf(ALICE), 100_000 ether, "a rejected mint changed user debt");
        assertEq(transmuter.reserves(), 20_000 * M, "a rejected mint changed reserves");
        assertEq(transmuter.requiredBuffer(), 20_000 * M, "the rejected issuance changed the floor");
        assertTrue(transmuter.bufferHealthy(), "a rejected issuance left the buffer unhealthy");
    }

    /// @dev Negative control for the prospective-buffer PoC: a mint whose post-supply requirement
    ///      fits inside existing reserves remains healthy under the same market wiring.
    function test_control_mint_within_prospective_buffer_headroom_remains_healthy() public {
        AuditVault vault = new AuditVault(IERC20(address(usdc)));
        (Denari dnr, Transmuter transmuter, Alchemist alchemist) = _deployMarket(IERC4626(address(vault)), 20_000 * M);

        _fundAndApprove(ALICE, alchemist, 100_000 * M);
        vm.prank(ALICE);
        alchemist.deposit(100_000 * M, 1);
        vm.roll(block.number + 1);

        vm.prank(ALICE);
        alchemist.mint(50_000 ether);

        assertEq(dnr.totalSupply(), 50_000 ether, "the bounded mint was issued");
        assertEq(transmuter.reserves(), 20_000 * M, "the control uses the same reserve seed");
        assertEq(transmuter.requiredBuffer(), 10_000 * M, "the prospective floor fits the seed");
        assertTrue(transmuter.bufferHealthy(), "a mint inside buffer headroom remains healthy");
    }

    /// @dev Mutation check: this PoC stops succeeding once Alchemist deposits enforce a caller's
    ///      minimum share return (or otherwise reject the zero-share ERC-4626 result).
    function test_regression_deposit_enforces_the_callers_minimum_share_return() public {
        AuditVault cleanVault = new AuditVault(IERC20(address(usdc)));
        (,, Alchemist cleanAlchemist) = _deployMarket(IERC4626(address(cleanVault)), 0);
        uint256 cleanAssets = 49_999 * M;
        _fundAndApprove(ALICE, cleanAlchemist, cleanAssets);
        vm.prank(ALICE);
        IMinShareAlchemist(address(cleanAlchemist)).deposit(cleanAssets, cleanAssets);

        AuditVault vault = new AuditVault(IERC20(address(usdc)));
        (,, Alchemist alchemist) = _deployMarket(IERC4626(address(vault)), 0);

        uint256 attackCost = 100_000 * M + 1;
        usdc.mint(ATTACKER, attackCost);
        vm.startPrank(ATTACKER);
        usdc.approve(address(vault), type(uint256).max);
        uint256 attackerShares = vault.deposit(1, ATTACKER);
        usdc.transfer(address(vault), 100_000 * M);
        vm.stopPrank();

        assertEq(attackerShares, 1, "the attacker owns the only real share");
        assertEq(vault.totalAssets(), attackCost, "the donation inflates that share's price");

        uint256 victimAssets = 49_999 * M;
        _fundAndApprove(VICTIM_ONE, alchemist, victimAssets);
        vm.prank(VICTIM_ONE);
        vm.expectRevert(abi.encodeWithSelector(Alchemist.InsufficientShares.selector, 0, victimAssets));
        IMinShareAlchemist(address(alchemist)).deposit(victimAssets, victimAssets);

        assertEq(vault.totalSupply(), 1, "the rejected deposit minted vault shares");
        assertEq(alchemist.principalOf(VICTIM_ONE), 0, "the rejected deposit recorded principal");
        assertEq(address(alchemist.escrowOf(VICTIM_ONE)).code.length, 0, "the rejected deposit kept an escrow");
    }

    /// @dev Negative control for the donation PoC: without the attacker-created exchange-rate
    ///      distortion, the same fresh OZ vault mints one share unit per deposited asset unit.
    function test_control_fresh_unmanipulated_vault_mints_expected_shares_and_collateral() public {
        AuditVault vault = new AuditVault(IERC20(address(usdc)));
        (,, Alchemist alchemist) = _deployMarket(IERC4626(address(vault)), 0);

        uint256 assets = 49_999 * M;
        _fundAndApprove(ALICE, alchemist, assets);
        vm.prank(ALICE);
        alchemist.deposit(assets, assets);

        CollateralEscrow escrow = alchemist.escrowOf(ALICE);
        assertEq(vault.balanceOf(address(escrow)), assets, "the clean deposit mints expected shares");
        assertEq(vault.totalSupply(), assets, "the fresh vault has a one-to-one initial share supply");
        assertEq(alchemist.principalOf(ALICE), assets, "principal matches assets deposited");
        assertEq(alchemist.collateralOf(ALICE), assets, "the shares preserve the full collateral claim");
    }

    /// @dev Mutation check: this PoC stops succeeding if harvest accounts for the escrow's actual
    ///      share-value loss or rejects a post-harvest unhealthy position.
    function test_regression_exit_fee_vault_does_not_report_unrealizable_yield() public {
        AuditExitFeeVault vault = new AuditExitFeeVault(IERC20(address(usdc)), 1_000, VAULT_FEE_RECIPIENT);
        (, Transmuter transmuter, Alchemist alchemist) = _deployMarket(IERC4626(address(vault)), 500_000 * M);

        vm.startPrank(SAFE);
        alchemist.setLtvBps(8_000);
        alchemist.setHarvestFee(2_000, PROTOCOL_FEE_RECIPIENT);
        vm.stopPrank();

        _fundAndApprove(ALICE, alchemist, 1_000 * M);
        vm.prank(ALICE);
        alchemist.deposit(1_000 * M, 1);
        vm.roll(block.number + 1);

        vm.prank(ALICE);
        alchemist.mint(720 ether);

        vault.earn(100 * M);

        uint256 debtBefore = alchemist.debtOf(ALICE);
        uint256 reservesBefore = transmuter.reserves();
        uint256 sharesBefore = vault.balanceOf(address(alchemist.escrowOf(ALICE)));

        vm.prank(BOB);
        vm.expectRevert(Alchemist.NothingToHarvest.selector);
        alchemist.harvest(ALICE);

        assertEq(alchemist.debtOf(ALICE), debtBefore, "a rejected harvest changed debt");
        assertEq(transmuter.reserves(), reservesBefore, "a rejected harvest changed reserves");
        assertEq(vault.balanceOf(address(alchemist.escrowOf(ALICE))), sharesBefore, "a rejected harvest burned shares");
        assertEq(usdc.balanceOf(VAULT_FEE_RECIPIENT), 0, "a rejected harvest paid the vault fee");
        assertEq(alchemist.accruedFees(), 0, "a rejected harvest accrued a protocol fee");
    }

    /// @dev Negative control for the exit-fee PoC: at the same 80% LTV plus 20% protocol-fee
    ///      boundary, an otherwise identical harvest against a fee-free OZ vault remains healthy.
    function test_control_fee_free_harvest_at_ltv_fee_boundary_remains_healthy() public {
        AuditVault vault = new AuditVault(IERC20(address(usdc)));
        (, Transmuter transmuter, Alchemist alchemist) = _deployMarket(IERC4626(address(vault)), 500_000 * M);

        vm.startPrank(SAFE);
        alchemist.setLtvBps(8_000);
        alchemist.setHarvestFee(2_000, PROTOCOL_FEE_RECIPIENT);
        vm.stopPrank();

        _fundAndApprove(ALICE, alchemist, 1_000 * M);
        vm.prank(ALICE);
        alchemist.deposit(1_000 * M, 1);
        vm.roll(block.number + 1);

        usdc.mint(address(vault), 100 * M);

        uint256 debtAtCeiling = 879_999_999_200_000_000_000;
        assertEq(alchemist.maxDebtOf(ALICE), debtAtCeiling, "the control starts at the same debt ceiling");
        vm.prank(ALICE);
        alchemist.mint(debtAtCeiling);

        vm.prank(BOB);
        alchemist.harvest(ALICE);

        assertEq(alchemist.debtOf(ALICE), 799_999_999_200_000_000_000, "the same net yield clears debt");
        assertEq(alchemist.collateralOf(ALICE), 1_000_000_000, "no vault fee consumes extra collateral");
        assertEq(alchemist.maxDebtOf(ALICE), 800_000_000_000_000_000_000, "fee-free post-harvest ceiling");
        assertLe(alchemist.debtOf(ALICE), alchemist.maxDebtOf(ALICE), "fee-free harvest remains healthy");
        assertEq(alchemist.accruedFees(), 19_999_999, "the protocol fee is still charged");
        assertEq(transmuter.reserves(), 500_080_000_000, "net yield still increases redemption backing");
    }

    function _deployMarket(IERC4626 vault, uint256 reserveSeed)
        private
        returns (Denari dnr, Transmuter transmuter, Alchemist alchemist)
    {
        dnr = new Denari("Audit Denari", "aDNR", SAFE);
        transmuter = new Transmuter(dnr, IERC20(address(usdc)), SAFE);
        alchemist = new Alchemist(dnr, IERC20(address(usdc)), vault, transmuter, SAFE);

        vm.startPrank(SAFE);
        dnr.setMinter(address(alchemist));
        dnr.setBurner(address(transmuter));
        transmuter.setFunder(address(alchemist), true);
        transmuter.setFunder(SAFE, true);
        alchemist.setLtvBps(5_000);
        vm.stopPrank();

        if (reserveSeed != 0) {
            usdc.mint(SAFE, reserveSeed);
            vm.startPrank(SAFE);
            usdc.approve(address(transmuter), reserveSeed);
            transmuter.fund(reserveSeed);
            vm.stopPrank();
        }
    }

    function _fundAndApprove(address user, Alchemist alchemist, uint256 assets) private {
        usdc.mint(user, assets);
        vm.prank(user);
        usdc.approve(address(alchemist), type(uint256).max);
    }

    function _depositZeroShareVictim(Alchemist alchemist, AuditVault vault, address victim) private {
        uint256 victimAssets = 49_999 * M;
        _fundAndApprove(victim, alchemist, victimAssets);

        vm.prank(victim);
        alchemist.deposit(victimAssets, 1);

        CollateralEscrow escrow = alchemist.escrowOf(victim);
        assertEq(vault.balanceOf(address(escrow)), 0, "the victim received zero vault shares");
        assertEq(alchemist.principalOf(victim), victimAssets, "Alchemist nevertheless records principal");
        assertEq(alchemist.collateralOf(victim), 0, "the recorded deposit has no collateral claim");
    }
}
