// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {TestBankAsset, TestBankVault} from "./testnet/TestBankDependencies.sol";
import {Denari} from "../src/Denari.sol";
import {Transmuter} from "../src/Transmuter.sol";
import {Alchemist} from "../src/Alchemist.sol";

/// @notice Robinhood testnet-only Bank rehearsal with fixed, non-production dependencies.
/// @dev Deploys everything unarmed. The Safe must seed/configure roles in a separate reviewed batch.
contract DeployTestnetBank is Script {
    uint256 public constant ROBINHOOD_TESTNET_CHAIN_ID = 46630;
    uint256 public constant INITIAL_TEST_ASSET_SUPPLY = 1_000_000e6;

    struct Deployment {
        address testAsset;
        address testVault;
        address denari;
        address transmuter;
        address alchemist;
    }

    function run() external returns (Deployment memory d) {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        address safe = _requiredAddress("SAFE");
        require(expectedChainId == ROBINHOOD_TESTNET_CHAIN_ID, "DeployTestnetBank: testnet only");
        require(block.chainid == expectedChainId, "DeployTestnetBank: RPC chain id mismatch");

        vm.startBroadcast();
        TestBankAsset testAsset = new TestBankAsset(safe, INITIAL_TEST_ASSET_SUPPLY);
        TestBankVault testVault = new TestBankVault(IERC20(address(testAsset)));
        Denari denari = new Denari("Denari", "DNR", safe);
        Transmuter transmuter = new Transmuter(denari, IERC20(address(testAsset)), safe);
        Alchemist alchemist =
            new Alchemist(denari, IERC20(address(testAsset)), IERC4626(address(testVault)), transmuter, safe);
        vm.stopBroadcast();

        require(testAsset.decimals() == 6, "DeployTestnetBank: wrong asset decimals");
        require(testVault.asset() == address(testAsset), "DeployTestnetBank: vault asset mismatch");
        require(transmuter.scale() == 1e12, "DeployTestnetBank: Transmuter scale mismatch");
        require(alchemist.scale() == 1e12, "DeployTestnetBank: Alchemist scale mismatch");
        require(denari.minter() == address(0) && denari.burner() == address(0), "DeployTestnetBank: roles armed");

        d = Deployment({
            testAsset: address(testAsset),
            testVault: address(testVault),
            denari: address(denari),
            transmuter: address(transmuter),
            alchemist: address(alchemist)
        });

        console.log("TestBankAsset:", d.testAsset);
        console.log("TestBankVault:", d.testVault);
        console.log("Denari:       ", d.denari);
        console.log("Transmuter:   ", d.transmuter);
        console.log("Alchemist:    ", d.alchemist);
        console.log("TESTNET ONLY. Bank roles, funders, caps, and reserves remain OFF/empty.");
    }

    function _requiredAddress(string memory key) private view returns (address value) {
        value = vm.envAddress(key);
        require(value != address(0), string.concat("DeployTestnetBank: zero ", key));
    }
}
