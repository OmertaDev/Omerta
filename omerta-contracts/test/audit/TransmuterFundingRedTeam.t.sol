// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

import {Alchemist} from "../../src/Alchemist.sol";
import {Denari} from "../../src/Denari.sol";
import {Transmuter} from "../../src/Transmuter.sol";

contract AuditFeeOnTransferAsset is ERC20 {
    address private constant FEE_RECIPIENT = address(0xFEE);

    constructor() ERC20("Fee USD", "fUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }
        uint256 fee = amount / 10;
        super._update(from, to, amount - fee);
        super._update(from, FEE_RECIPIENT, fee);
    }
}

contract AuditFeeOnTransferVault is ERC4626 {
    constructor(IERC20 asset_) ERC4626(asset_) ERC20("Fee Vault", "fvUSD") {}
}

contract TransmuterFundingRedTeamTest is Test {
    address private constant SAFE = address(0x5AFE);

    function test_regression_funding_cannot_overstate_fee_on_transfer_reserves() public {
        AuditFeeOnTransferAsset asset = new AuditFeeOnTransferAsset();
        Denari dnr = new Denari("Audit Denari", "aDNR", SAFE);
        Transmuter transmuter = new Transmuter(dnr, IERC20(address(asset)), SAFE);

        uint256 assets = 100e6;
        asset.mint(SAFE, assets);
        vm.startPrank(SAFE);
        transmuter.setFunder(SAFE, true);
        asset.approve(address(transmuter), assets);
        vm.expectRevert(
            abi.encodeWithSelector(bytes4(keccak256("AssetTransferMismatch(uint256,uint256)")), 90e6, assets)
        );
        transmuter.fund(assets);
        vm.stopPrank();

        assertEq(transmuter.reserves(), 0, "a rejected transfer changed tracked reserves");
        assertEq(asset.balanceOf(address(transmuter)), 0, "a rejected transfer left physical reserves");
    }

    function test_regression_deposit_cannot_record_more_than_the_escrow_received() public {
        AuditFeeOnTransferAsset asset = new AuditFeeOnTransferAsset();
        AuditFeeOnTransferVault vault = new AuditFeeOnTransferVault(IERC20(address(asset)));
        Denari dnr = new Denari("Audit Denari", "aDNR", SAFE);
        Transmuter transmuter = new Transmuter(dnr, IERC20(address(asset)), SAFE);
        Alchemist alchemist = new Alchemist(dnr, IERC20(address(asset)), IERC4626(address(vault)), transmuter, SAFE);

        address user = address(0xA11CE);
        uint256 assets = 100e6;
        asset.mint(user, assets);
        vm.startPrank(user);
        asset.approve(address(alchemist), assets);
        vm.expectRevert(abi.encodeWithSelector(Alchemist.AssetTransferMismatch.selector, 90e6, assets));
        alchemist.deposit(assets, 1);
        vm.stopPrank();

        assertEq(alchemist.principalOf(user), 0, "a rejected transfer recorded principal");
        assertEq(address(alchemist.escrowOf(user)), address(0), "a rejected transfer retained an escrow");
        assertEq(asset.balanceOf(user), assets, "the reverted transfer charged the user");
    }

    function test_deposit_requires_a_nonzero_caller_share_floor() public {
        AuditFeeOnTransferAsset asset = new AuditFeeOnTransferAsset();
        AuditFeeOnTransferVault vault = new AuditFeeOnTransferVault(IERC20(address(asset)));
        Denari dnr = new Denari("Audit Denari", "aDNR", SAFE);
        Transmuter transmuter = new Transmuter(dnr, IERC20(address(asset)), SAFE);
        Alchemist alchemist = new Alchemist(dnr, IERC20(address(asset)), IERC4626(address(vault)), transmuter, SAFE);

        vm.prank(address(0xA11CE));
        vm.expectRevert(Alchemist.ZeroAmount.selector);
        alchemist.deposit(1, 0);
    }
}
