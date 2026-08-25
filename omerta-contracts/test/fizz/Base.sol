// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Actor} from "./Actor.sol";
import {Clamp} from "./utils/Clamp.sol";
import {DecimalPrinter} from "./utils/DecimalPrinter.sol";
import {Deployer} from "./utils/Deployer.sol";
import {vm} from "./utils/Hevm.sol";
import {Logger} from "./utils/Logger.sol";
import {Math} from "./utils/Math.sol";
import {StringUtils} from "./utils/StringUtils.sol";
import {EnumerableSet} from "./utils/EnumerableSet.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Alchemist} from "../../src/Alchemist.sol";
import {Denari} from "../../src/Denari.sol";
import {Transmuter} from "../../src/Transmuter.sol";
import {OMR} from "../../src/OMR.sol";
import {OMRStaking} from "../../src/OMRStaking.sol";
import {GearVault} from "../../src/GearVault.sol";
import {StockVault} from "../../src/StockVault.sol";
import {OmrTwapOracle, IUniswapV2Factory, IUniswapV2Pair} from "../../src/OmrTwapOracle.sol";
import {FuzzUSDC, FuzzVault, FuzzWETH, FuzzFactory, FuzzPair} from "./utils/FuzzMocks.sol";

/// @notice Base contract with state variables and setup functions
abstract contract Base is StringUtils, Clamp, Deployer, Math {
    using DecimalPrinter for uint256;

    string[] internal ACTOR_LABELS = ["Alice", "Bob", "Charlie"];
    uint256 internal constant BLOCK_INTERVAL = 12 seconds;
    uint256 internal constant INITIAL_ETH_BALANCE = 1_000 ether;
    uint256 internal constant USDC_UNIT = 1e6;
    uint256 internal constant INITIAL_USDC_BALANCE = 2_000_000 * USDC_UNIT;
    uint256 internal constant INITIAL_OMR_BALANCE = 10_000_000 ether;

    // ―――――――――――――――――――――――――― Ghosts ――――――――――――――――――――――――――

    struct Ghosts {
        uint256 _placeholder;
    }

    Ghosts internal ghosts;

    // ―――――――――――――――――――――――――― Actors ――――――――――――――――――――――――――

    address[] internal actors;
    address internal actor;
    address internal admin;

    modifier asActor() virtual {
        vm.startPrank(actor);
        _;
        vm.stopPrank();
    }

    modifier asAdmin() virtual {
        vm.startPrank(admin);
        _;
        vm.stopPrank();
    }

    // ―――――――――――――――――――――――― Contracts ―――――――――――――――――――――――――

    FuzzUSDC public reserveAsset;
    FuzzVault public yieldVault;
    Denari public denari;
    Transmuter public transmuter;
    Alchemist public alchemist;

    OMR public oMR;
    OMRStaking public oMRStaking;

    GearVault public gearVault;
    StockVault public stockVault;

    FuzzPair public fuzzPair;
    FuzzWETH public fuzzWeth;
    FuzzFactory public fuzzFactory;
    OmrTwapOracle public omrTwapOracle;

    // ―――――――――――――――――――――――――― Setup ―――――――――――――――――――――――――――

    function setup() internal {
        setupActors();

        reserveAsset = new FuzzUSDC();
        yieldVault = new FuzzVault(IERC20(address(reserveAsset)));
        denari = new Denari("Denari", "DNR", address(this));
        transmuter = new Transmuter(denari, IERC20(address(reserveAsset)), address(this));
        alchemist = new Alchemist(
            denari, IERC20(address(reserveAsset)), IERC4626(address(yieldVault)), transmuter, address(this)
        );

        denari.setMinter(address(alchemist));
        denari.setBurner(address(transmuter));
        transmuter.setFunder(address(alchemist), true);
        transmuter.setFunder(address(this), true);
        for (uint256 i; i < actors.length; ++i) {
            alchemist.setAllowedContract(actors[i], true);
        }
        // Start healthy but close enough to the reserve floor that stateful issuance can
        // cross it. An over-seeded harness makes the prospective-buffer transition unreachable.
        reserveAsset.mint(address(this), 100_000 * USDC_UNIT);
        reserveAsset.approve(address(transmuter), type(uint256).max);
        transmuter.fund(100_000 * USDC_UNIT);

        oMR = new OMR(address(this));
        oMRStaking = new OMRStaking(address(this), IERC20(address(oMR)), 1_400);
        oMR.setTaxRecipients(actors[0], actors[1], actors[2], address(this));

        gearVault = new GearVault(address(this), "ipfs://fuzz/");
        gearVault.setMinter(address(this));
        for (uint256 id = 1; id <= 8; ++id) {
            gearVault.setGearCap(id, 1_000_000);
        }

        stockVault = new StockVault(address(this), address(this), 500_000 * USDC_UNIT);
        reserveAsset.mint(address(stockVault), 10_000_000 * USDC_UNIT);

        fuzzWeth = new FuzzWETH();
        fuzzPair = new FuzzPair(address(fuzzWeth), address(oMR), 1_000 ether, 5_000_000 ether);
        fuzzFactory = new FuzzFactory(address(oMR), address(fuzzWeth), address(fuzzPair));
        omrTwapOracle = new OmrTwapOracle(
            address(this),
            IUniswapV2Factory(address(fuzzFactory)),
            IUniswapV2Pair(address(fuzzPair)),
            address(oMR),
            address(fuzzWeth),
            10 minutes
        );

        for (uint256 i; i < actors.length; ++i) {
            reserveAsset.mint(actors[i], INITIAL_USDC_BALANCE);
            oMR.transfer(actors[i], INITIAL_OMR_BALANCE);

            vm.startPrank(actors[i]);
            reserveAsset.approve(address(alchemist), type(uint256).max);
            reserveAsset.approve(address(transmuter), type(uint256).max);
            denari.approve(address(transmuter), type(uint256).max);
            oMR.approve(address(oMRStaking), type(uint256).max);
            vm.stopPrank();
        }

        vm.roll(1_000);
        vm.warp(1_000_000);
    }

    function setupActors() internal {
        admin = address(this);
        vm.label(admin, "Admin");

        for (uint256 i; i < ACTOR_LABELS.length; i++) {
            address _actor = address(new Actor{value: INITIAL_ETH_BALANCE}());
            actors.push(_actor);
            if (ACTOR_LABELS.length > i) {
                vm.label(_actor, ACTOR_LABELS[i]);
            }
        }
        actor = actors[0];
    }

    // ――――――――――――――――――――――――― Helpers ――――――――――――――――――――――――――

    // Maps an arbitrary address to an actor address
    function toActor(address addy) internal view returns (address) {
        return actors[uint256(uint160(addy)) % actors.length];
    }

    // Maps an arbitrary address to an actor address that is different from the current actor
    function toActorNotCurrent(address addy) internal view returns (address) {
        address _actor = actors[uint256(uint160(addy)) % actors.length];
        if (_actor == actor) {
            _actor = actors[(uint256(uint160(addy)) + 1) % actors.length];
        }
        return _actor;
    }

    // Sums the native token balances of all actors
    function sumActorsBalances() internal view returns (uint256 sumOfBalances) {
        for (uint256 i; i < actors.length; i++) {
            sumOfBalances += actors[i].balance;
        }
    }

    // Sums the ERC-20 token balances of all actors for a given token
    function sumActorsERC20Balances(address _token) internal view returns (uint256 sumOfBalances) {
        for (uint256 i; i < actors.length; i++) {
            bytes memory data = abi.encodeWithSignature("balanceOf(address)", actors[i]);
            (bool success, bytes memory result) = _token.staticcall(data);
            require(success, "sumActorsERC20Balances: failed to get balance");
            sumOfBalances += abi.decode(result, (uint256));
        }
    }

    function skipBlocks(uint256 blocks) internal {
        vm.roll(block.number + blocks);
        vm.warp(block.timestamp + blocks * BLOCK_INTERVAL);
    }

    function skipTime(uint256 time) internal {
        uint256 blocks = (time + BLOCK_INTERVAL - 1) / BLOCK_INTERVAL;
        vm.roll(block.number + blocks);
        vm.warp(block.timestamp + time);
    }
}
