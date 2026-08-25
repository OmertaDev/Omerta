// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {RwaStockBuyer, IStockSwapAdapter, IStockQuoteOracle} from "../../src/RwaStockBuyer.sol";
import {StockTokenRegistry} from "../../src/StockTokenRegistry.sol";
import {StockVault} from "../../src/StockVault.sol";

contract AuditRwaStockToken is ERC20 {
    constructor() ERC20("Audit Apple Stock", "aAAPL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev A conventional x*y=k venue charging 30 bps. Neither its price nor its route is controlled
///      by the buyer adapter; an external trader can move the price before and after a purchase.
contract AuditStockPool {
    using SafeERC20 for IERC20;

    IERC20 public immutable stock;

    constructor(IERC20 stock_) {
        stock = stock_;
    }

    function seed(uint256 stockUnits) external payable {
        stock.safeTransferFrom(msg.sender, address(this), stockUnits);
    }

    function buyStock(address recipient, uint256 minUnits) external payable returns (uint256 units) {
        uint256 ethReserveBefore = address(this).balance - msg.value;
        uint256 stockReserveBefore = stock.balanceOf(address(this));
        uint256 amountInWithFee = msg.value * 997;
        units = stockReserveBefore * amountInWithFee / (ethReserveBefore * 1_000 + amountInWithFee);
        require(units >= minUnits, "pool: slippage");
        stock.safeTransfer(recipient, units);
    }

    function sellStock(uint256 stockUnits, address payable recipient, uint256 minEth)
        external
        returns (uint256 ethOut)
    {
        uint256 ethReserveBefore = address(this).balance;
        uint256 stockReserveBefore = stock.balanceOf(address(this));
        stock.safeTransferFrom(msg.sender, address(this), stockUnits);
        uint256 amountInWithFee = stockUnits * 997;
        ethOut = ethReserveBefore * amountInWithFee / (stockReserveBefore * 1_000 + amountInWithFee);
        require(ethOut >= minEth, "pool: slippage");
        (bool ok,) = recipient.call{value: ethOut}("");
        require(ok, "pool: eth transfer");
    }
}

/// @dev A fixed, Safe-approved adapter: it always buys the resolved token from the same pool and
///      forwards the caller's slippage floor. The keeper cannot redirect ETH or change venues.
contract AuditStockPoolAdapter is IStockSwapAdapter {
    AuditStockPool public immutable pool;

    constructor(AuditStockPool pool_) {
        pool = pool_;
    }

    function buy(address token, address recipient, uint256 minUnits, bytes calldata) external payable {
        require(token == address(pool.stock()), "adapter: wrong token");
        pool.buyStock{value: msg.value}(recipient, minUnits);
    }
}

/// @dev Independent fair-value policy: at least eight native stock units per ETH. This test oracle
///      is fixed only so the regression isolates whether the compromised keeper can lower the floor;
///      production must use the audited fresh TWAP/signed-price implementation named by the runbook.
contract AuditStockQuoteOracle is IStockQuoteOracle {
    function minUnitsOut(address, uint256 ethIn) external view returns (uint256, uint256) {
        return (ethIn * 8 ether / 1 ether, block.timestamp);
    }
}

contract RwaStockMachineRedTeamTest is Test {
    address private constant SAFE = address(0x5AFE);
    address private constant PUBLISHER = address(0xB41107);
    address private constant COMPROMISED_KEEPER = address(0xBAD);

    bytes32 private constant AAPL_KEY = keccak256("AAPL");
    bytes32 private constant AAPL_ASSET_ID = keccak256("robinhood-aapl-asset-id");

    AuditRwaStockToken private stock;
    AuditStockPool private pool;
    StockVault private stockVault;
    StockTokenRegistry private registry;
    RwaStockBuyer private buyer;
    uint256 private ballotDay;

    function setUp() public {
        vm.warp(100 days);
        stock = new AuditRwaStockToken();
        pool = new AuditStockPool(IERC20(address(stock)));
        AuditStockPoolAdapter adapter = new AuditStockPoolAdapter(pool);
        stockVault = new StockVault(SAFE, address(0), 1_000_000 ether);
        registry = new StockTokenRegistry(SAFE, PUBLISHER);
        buyer = new RwaStockBuyer(
            SAFE, COMPROMISED_KEEPER, address(registry), address(adapter), address(stockVault), 5 ether
        );

        vm.startPrank(SAFE);
        buyer.setQuoteOracle(address(new AuditStockQuoteOracle()), 1 hours);
        registry.upsertAsset(AAPL_KEY, address(stock), AAPL_ASSET_ID, "AAPL", "Apple", true);
        buyer.unpause();
        vm.stopPrank();
        ballotDay = block.timestamp / 1 days - 1;
        vm.prank(PUBLISHER);
        registry.publishBallot(ballotDay, AAPL_KEY, keccak256("honest-closed-tally"));

        stock.mint(address(this), 1_000 ether);
        stock.approve(address(pool), type(uint256).max);
        vm.deal(address(this), 100 ether);
        pool.seed{value: 100 ether}(1_000 ether);

        vm.deal(address(buyer), 5 ether);
        vm.deal(COMPROMISED_KEEPER, 1_000 ether);
    }

    /// @dev Regression for the original proof: the only compromised component is the keeper. The
    ///      independent oracle floor replaces its `minUnits = 1`, so the manipulated fill cannot settle.
    function test_regression_keeper_cannot_weaken_min_units_and_lose_the_daily_eth_cap() public {
        vm.startPrank(COMPROMISED_KEEPER);
        pool.buyStock{value: 1_000 ether}(COMPROMISED_KEEPER, 1);
        vm.expectRevert(bytes("pool: slippage"));
        buyer.buy(ballotDay, 5 ether, 1, "");
        vm.stopPrank();

        assertEq(stock.balanceOf(address(stockVault)), 0, "manipulated stock never reached StockVault");
        assertEq(address(buyer).balance, 5 ether, "the failed fill preserved all buyer ETH");
        assertEq(buyer.spentOnDay(block.timestamp / 1 days), 0, "the failed fill consumed no daily budget");
        assertFalse(buyer.purchased(ballotDay), "the failed fill consumed no ballot latch");
    }

    /// @dev Negative control: the same manipulated pool cannot consume buyer ETH when an independent
    ///      fair-value floor is supplied. This is the bound that must not be controlled by the keeper.
    function test_control_fair_min_units_reverts_the_same_manipulated_fill() public {
        vm.prank(COMPROMISED_KEEPER);
        pool.buyStock{value: 1_000 ether}(COMPROMISED_KEEPER, 1);

        vm.prank(COMPROMISED_KEEPER);
        vm.expectRevert(bytes("pool: slippage"));
        buyer.buy(ballotDay, 5 ether, 40 ether, "");

        assertEq(address(buyer).balance, 5 ether, "failed slippage check preserves buyer ETH");
        assertEq(stock.balanceOf(address(stockVault)), 0, "no manipulated output reaches StockVault");
        assertEq(buyer.spentOnDay(block.timestamp / 1 days), 0, "failed purchase rolls back daily spend");
        assertFalse(buyer.purchased(ballotDay), "failed purchase rolls back the one-shot latch");
    }
}
