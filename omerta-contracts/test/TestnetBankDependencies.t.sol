// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

contract CreationHarness {
    function deploy(bytes memory creationCode) external returns (address deployed) {
        assembly ("memory-safe") {
            deployed := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(deployed != address(0), "CreationHarness: create failed");
    }
}

contract TestnetBankDependenciesTest is Test {
    string private constant ASSET_ARTIFACT = "TestBankDependencies.sol:TestBankAsset";
    string private constant VAULT_ARTIFACT = "TestBankDependencies.sol:TestBankVault";
    uint256 private constant INITIAL_SUPPLY = 1_000_000e6;

    address private safe = address(0x5AFE);
    CreationHarness private harness;

    function setUp() public {
        harness = new CreationHarness();
        vm.chainId(46630);
    }

    function test_deploys_fixed_supply_six_decimal_asset_to_safe() public {
        IERC20Metadata asset = IERC20Metadata(_deployAsset());

        assertEq(asset.name(), "Test Bank USD");
        assertEq(asset.symbol(), "tbUSD");
        assertEq(asset.decimals(), 6);
        assertEq(asset.totalSupply(), INITIAL_SUPPLY);
        assertEq(asset.balanceOf(safe), INITIAL_SUPPLY);
    }

    function test_asset_has_no_post_deployment_mint_surface() public {
        address asset = _deployAsset();

        (bool ok,) = asset.call(abi.encodeWithSignature("mint(address,uint256)", safe, 1));

        assertFalse(ok);
        assertEq(IERC20(asset).totalSupply(), INITIAL_SUPPLY);
    }

    function test_vault_is_a_working_erc4626_for_the_test_asset() public {
        IERC20 asset = IERC20(_deployAsset());
        IERC4626 vault = IERC4626(_deployVault(asset));

        assertEq(vault.asset(), address(asset));
        assertEq(IERC20Metadata(address(vault)).name(), "Vault Test Bank USD");
        assertEq(IERC20Metadata(address(vault)).symbol(), "vtbUSD");

        vm.startPrank(safe);
        asset.approve(address(vault), 100e6);
        uint256 shares = vault.deposit(100e6, safe);
        vm.stopPrank();

        assertEq(shares, 100e6);
        assertEq(vault.totalAssets(), 100e6);
        assertEq(vault.balanceOf(safe), 100e6);
    }

    function test_dependencies_refuse_non_robinhood_testnet_chains() public {
        vm.chainId(1);
        bytes memory assetCreation = abi.encodePacked(vm.getCode(ASSET_ARTIFACT), abi.encode(safe, INITIAL_SUPPLY));
        vm.expectRevert("CreationHarness: create failed");
        harness.deploy(assetCreation);

        vm.chainId(46630);
        IERC20 asset = IERC20(_deployAsset());
        vm.chainId(1);
        bytes memory vaultCreation = abi.encodePacked(vm.getCode(VAULT_ARTIFACT), abi.encode(asset));
        vm.expectRevert("CreationHarness: create failed");
        harness.deploy(vaultCreation);
    }

    function _deployAsset() private returns (address) {
        bytes memory creation = abi.encodePacked(vm.getCode(ASSET_ARTIFACT), abi.encode(safe, INITIAL_SUPPLY));
        return harness.deploy(creation);
    }

    function _deployVault(IERC20 asset) private returns (address) {
        bytes memory creation = abi.encodePacked(vm.getCode(VAULT_ARTIFACT), abi.encode(asset));
        return harness.deploy(creation);
    }
}
