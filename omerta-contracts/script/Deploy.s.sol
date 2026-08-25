// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OMR} from "../src/OMR.sol";
import {GearVault} from "../src/GearVault.sol";
import {VoucherClaim, IGearVault} from "../src/VoucherClaim.sol";
import {OMRStaking} from "../src/OMRStaking.sol";
import {OmertaFees} from "../src/OmertaFees.sol";
import {StreetDeed} from "../src/StreetDeed.sol";
import {DynastyNFT} from "../src/DynastyNFT.sol";
import {StockVault} from "../src/StockVault.sol";
import {GenesisOracle} from "../src/GenesisOracle.sol";
import {OmertaBond} from "../src/OmertaBond.sol";

/// @notice Phase 1: deploy every OMERTA contract that does not depend on an existing market.
/// @dev Every privileged contract is owned by SAFE from birth. This script deliberately does not
///      arm minters, keepers, gear classes, or the bond oracle: those are Safe transactions after
///      the deployed bytecode and constructor values have been verified.
///
/// Run a simulation first, then add --broadcast only after reviewing the trace:
///   forge script script/Deploy.s.sol:Deploy --rpc-url $CHAIN_RPC_URL --account omerta-deployer -vvvv
contract Deploy is Script {
    struct Config {
        uint256 expectedChainId;
        address safe;
        address signer;
        address payable devWallet;
        address payable vigWallet;
        address payable polWallet;
        uint256 voucherDailyCap;
        uint256 stakingApyBps;
        uint256 feeVigBps;
        uint256 mintFee;
        uint256 respawnFee;
        uint256 deedDailyMintCap;
        uint256 dynastyDailyMintCap;
        uint256 dynastyRoyaltyBps;
        uint256 stockDefaultDailyCap;
        uint256 bondPolBps;
        uint256 bondDevBps;
        uint256 bondRwaBps;
        uint256 bondVigBps;
        uint256 bondDailyCap;
        uint256 bondMaxOmrPerEth;
        uint256 genesisPrice;
        uint256 genesisValidUntil;
        string gearImageBase;
        string deedImageBase;
        string deedExternalBase;
        string dynastyBaseUri;
    }

    struct Deployment {
        address omr;
        address gearVault;
        address voucherClaim;
        address staking;
        address fees;
        address streetDeed;
        address dynastyNft;
        address stockVault;
        address genesisOracle;
        address bond;
    }

    function run() external returns (Deployment memory d) {
        Config memory c = _loadConfig();
        _validate(c);

        vm.startBroadcast();

        OMR omr = new OMR(c.safe);
        GearVault gear = new GearVault(c.safe, c.gearImageBase);
        VoucherClaim voucher =
            new VoucherClaim(c.safe, c.signer, IERC20(address(omr)), IGearVault(address(gear)), c.voucherDailyCap);
        OMRStaking staking = new OMRStaking(c.safe, IERC20(address(omr)), c.stakingApyBps);
        OmertaFees fees = _deployFees(c);
        StreetDeed deed = new StreetDeed(c.safe, c.signer, c.deedImageBase, c.deedExternalBase, c.deedDailyMintCap);
        DynastyNFT dynasty = new DynastyNFT(
            c.safe, c.signer, c.dynastyBaseUri, c.safe, uint96(c.dynastyRoyaltyBps), c.dynastyDailyMintCap
        );

        // Keeper is intentionally OFF. The Safe must pre-fund, set per-token caps, and only then arm it.
        StockVault stock = new StockVault(c.safe, address(0), c.stockDefaultDailyCap);
        GenesisOracle genesis = new GenesisOracle(c.safe, c.genesisPrice, c.genesisValidUntil);
        OmertaBond bond = _deployBond(c, omr);

        vm.stopBroadcast();

        d = Deployment({
            omr: address(omr),
            gearVault: address(gear),
            voucherClaim: address(voucher),
            staking: address(staking),
            fees: address(fees),
            streetDeed: address(deed),
            dynastyNft: address(dynasty),
            stockVault: address(stock),
            genesisOracle: address(genesis),
            bond: address(bond)
        });
        _logDeployment(d);
    }

    function _deployFees(Config memory c) private returns (OmertaFees) {
        return new OmertaFees(c.safe, c.devWallet, c.vigWallet, c.feeVigBps, c.mintFee, c.respawnFee);
    }

    function _deployBond(Config memory c, OMR omr) private returns (OmertaBond) {
        // The treasury/RWA recipient is the Safe by policy. The Vig takes the unlisted remainder.
        return new OmertaBond(
            c.safe,
            c.signer,
            IERC20(address(omr)),
            c.bondPolBps,
            c.bondDevBps,
            c.bondRwaBps,
            c.polWallet,
            c.devWallet,
            payable(c.safe),
            c.vigWallet,
            c.bondDailyCap,
            c.bondMaxOmrPerEth
        );
    }

    function _loadConfig() private view returns (Config memory c) {
        c.expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        c.safe = _requiredAddress("SAFE");
        c.signer = _requiredAddress("SIGNER");
        c.devWallet = payable(_requiredAddress("DEV_WALLET"));
        c.vigWallet = payable(_requiredAddress("VIG_WALLET"));
        c.polWallet = payable(_requiredAddress("POL_WALLET"));
        c.voucherDailyCap = vm.envUint("DAILY_CAP_OMR");
        c.stakingApyBps = vm.envUint("STAKING_APY_BPS");
        c.feeVigBps = vm.envUint("VIG_BPS");
        c.mintFee = vm.envUint("MINT_FEE_WEI");
        c.respawnFee = vm.envUint("RESPAWN_FEE_WEI");
        c.deedDailyMintCap = vm.envUint("DEED_DAILY_MINT_CAP");
        c.dynastyDailyMintCap = vm.envUint("DYNASTY_DAILY_MINT_CAP");
        c.dynastyRoyaltyBps = vm.envUint("DYNASTY_ROYALTY_BPS");
        c.stockDefaultDailyCap = vm.envUint("STOCK_DEFAULT_DAILY_CAP");
        c.bondPolBps = vm.envUint("BOND_POL_BPS");
        c.bondDevBps = vm.envUint("BOND_DEV_BPS");
        c.bondRwaBps = vm.envUint("BOND_RWA_BPS");
        c.bondVigBps = vm.envUint("BOND_VIG_BPS");
        c.bondDailyCap = vm.envUint("BOND_DAILY_CAP_OMR");
        c.bondMaxOmrPerEth = vm.envUint("BOND_MAX_OMR_PER_ETH");
        c.genesisPrice = vm.envUint("GENESIS_PRICE_OMR_PER_ETH");
        c.genesisValidUntil = vm.envUint("GENESIS_VALID_UNTIL");
        c.gearImageBase = _requiredString("BASE_URI");
        c.deedImageBase = _requiredString("DEED_IMAGE_BASE");
        c.deedExternalBase = _requiredString("DEED_EXTERNAL_BASE");
        c.dynastyBaseUri = _requiredString("DYNASTY_BASE_URI");
    }

    function _validate(Config memory c) private view {
        require(block.chainid == c.expectedChainId, "Deploy: RPC chain id != EXPECTED_CHAIN_ID");
        require(c.signer != c.safe, "Deploy: signer must not be the treasury Safe");
        require(c.vigWallet != c.safe, "Deploy: Vig wallet must be separate from the treasury Safe");

        // Zero means unlimited for these walls, so a production deploy must choose a real bound.
        require(c.voucherDailyCap > 0, "Deploy: DAILY_CAP_OMR must be nonzero");
        require(c.deedDailyMintCap > 0, "Deploy: DEED_DAILY_MINT_CAP must be nonzero");
        require(c.dynastyDailyMintCap > 0, "Deploy: DYNASTY_DAILY_MINT_CAP must be nonzero");
        require(c.stockDefaultDailyCap > 0, "Deploy: STOCK_DEFAULT_DAILY_CAP must be nonzero");
        require(c.bondDailyCap > 0, "Deploy: BOND_DAILY_CAP_OMR must be nonzero");
        require(c.bondMaxOmrPerEth > 0, "Deploy: BOND_MAX_OMR_PER_ETH must be nonzero");

        require(c.stakingApyBps <= 5_000, "Deploy: staking APY exceeds contract ceiling");
        require(c.feeVigBps <= 10_000, "Deploy: VIG_BPS exceeds 100%");
        require(c.mintFee > 0 && c.respawnFee > 0, "Deploy: fees must be nonzero");
        require(c.dynastyRoyaltyBps <= 10_000, "Deploy: dynasty royalty exceeds 100%");

        uint256 namedBondBps = c.bondPolBps + c.bondDevBps + c.bondRwaBps;
        require(namedBondBps <= 10_000, "Deploy: named bond splits exceed 100%");
        require(namedBondBps + c.bondVigBps == 10_000, "Deploy: bond split does not sum to 100%");
        require(10_000 - namedBondBps == c.bondVigBps, "Deploy: BOND_VIG_BPS != on-chain remainder");

        // A zero/zero oracle is an explicitly closed genesis window. Any live window must end later.
        require(
            (c.genesisPrice == 0) == (c.genesisValidUntil == 0),
            "Deploy: genesis price and deadline must both be zero or both be set"
        );
        if (c.genesisPrice > 0) {
            require(c.genesisValidUntil > block.timestamp, "Deploy: genesis window already closed");
        }
    }

    function _requiredAddress(string memory key) private view returns (address value) {
        value = vm.envAddress(key);
        require(value != address(0), string.concat("Deploy: zero ", key));
    }

    function _requiredString(string memory key) private view returns (string memory value) {
        value = vm.envString(key);
        require(bytes(value).length != 0, string.concat("Deploy: empty ", key));
    }

    function _logDeployment(Deployment memory d) private pure {
        console.log("OMR:           ", d.omr);
        console.log("GearVault:     ", d.gearVault);
        console.log("VoucherClaim:  ", d.voucherClaim);
        console.log("OMRStaking:    ", d.staking);
        console.log("OmertaFees:    ", d.fees);
        console.log("StreetDeed:    ", d.streetDeed);
        console.log("DynastyNFT:    ", d.dynastyNft);
        console.log("StockVault:    ", d.stockVault);
        console.log("GenesisOracle: ", d.genesisOracle);
        console.log("OmertaBond:    ", d.bond);
        console.log("All owners are SAFE. Privileged paths remain OFF pending the Safe ceremony.");
        console.log("Next: follow DEPLOYMENT.md; verify bytecode, then build and simulate the Safe batch.");
    }
}
