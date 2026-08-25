// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {StockTokenRegistry} from "../src/StockTokenRegistry.sol";
import {RwaStockBuyer, IStockSwapAdapter, IStockQuoteOracle} from "../src/RwaStockBuyer.sol";

contract MockRobinhoodStockToken is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockStockSwapAdapter is IStockSwapAdapter {
    address public lastToken;
    address public lastRecipient;
    uint256 public lastValue;
    uint256 public unitsOut;

    constructor(uint256 unitsOut_) {
        unitsOut = unitsOut_;
    }

    function setUnitsOut(uint256 value) external {
        unitsOut = value;
    }

    function buy(address token, address recipient, uint256, bytes calldata) external payable {
        lastToken = token;
        lastRecipient = recipient;
        lastValue = msg.value;
        MockRobinhoodStockToken(token).mint(recipient, unitsOut);
    }
}

contract MockStockQuoteOracle is IStockQuoteOracle {
    uint256 public unitsPerEth;
    uint256 public observedAt;

    constructor(uint256 unitsPerEth_) {
        unitsPerEth = unitsPerEth_;
        observedAt = block.timestamp;
    }

    function set(uint256 unitsPerEth_, uint256 observedAt_) external {
        unitsPerEth = unitsPerEth_;
        observedAt = observedAt_;
    }

    function minUnitsOut(address, uint256 ethIn) external view returns (uint256, uint256) {
        return (ethIn * unitsPerEth / 1 ether, observedAt);
    }
}

contract MockStockVaultRecipient {}

contract RwaStockMachineTest is Test {
    StockTokenRegistry registry;
    RwaStockBuyer buyer;
    MockRobinhoodStockToken aapl;
    MockRobinhoodStockToken tsla;
    MockStockSwapAdapter adapter;
    MockStockQuoteOracle quoteOracle;

    address safe = makeAddr("safe");
    address ballotPublisher = makeAddr("ballotPublisher");
    address buyKeeper = makeAddr("buyKeeper");
    address stockVault;

    bytes32 constant AAPL_KEY = keccak256("AAPL");
    bytes32 constant TSLA_KEY = keccak256("TSLA");
    bytes32 constant AAPL_UID_HASH = keccak256("robinhood-aapl-asset-id");
    bytes32 constant TSLA_UID_HASH = keccak256("robinhood-tsla-asset-id");

    function setUp() public {
        vm.warp(100 days);
        aapl = new MockRobinhoodStockToken("Apple Stock Token", "AAPL");
        tsla = new MockRobinhoodStockToken("Tesla Stock Token", "TSLA");
        registry = new StockTokenRegistry(safe, ballotPublisher);
        adapter = new MockStockSwapAdapter(25e18);
        quoteOracle = new MockStockQuoteOracle(5e18);
        stockVault = address(new MockStockVaultRecipient());
        buyer = new RwaStockBuyer(safe, buyKeeper, address(registry), address(adapter), stockVault, 5 ether);

        vm.startPrank(safe);
        buyer.setQuoteOracle(address(quoteOracle), 1 hours);
        registry.upsertAsset(AAPL_KEY, address(aapl), AAPL_UID_HASH, "AAPL", "Apple", true);
        registry.upsertAsset(TSLA_KEY, address(tsla), TSLA_UID_HASH, "TSLA", "Tesla", true);
        buyer.unpause();
        vm.stopPrank();
        vm.deal(address(buyer), 20 ether);
    }

    function test_safe_curates_an_enumerable_canonical_catalog() public view {
        assertEq(registry.ROBINHOOD_CHAIN_ID(), 4663);
        assertEq(registry.assetCount(), 2);
        assertEq(registry.assetKeyAt(0), AAPL_KEY);
        StockTokenRegistry.Asset memory asset = registry.getAsset(AAPL_KEY);
        assertEq(asset.token, address(aapl));
        assertEq(asset.robinhoodAssetIdHash, AAPL_UID_HASH);
        assertEq(asset.ticker, "AAPL");
        assertEq(asset.name, "Apple");
        assertTrue(asset.active);
    }

    function test_only_safe_can_curate_and_registry_rejects_ambiguous_identity() public {
        vm.expectRevert();
        registry.upsertAsset(keccak256("NVDA"), address(aapl), keccak256("nvda"), "NVDA", "Nvidia", true);

        vm.startPrank(safe);
        vm.expectRevert(StockTokenRegistry.TickerKeyMismatch.selector);
        registry.upsertAsset(AAPL_KEY, address(aapl), AAPL_UID_HASH, "MSFT", "Microsoft", true);
        vm.expectRevert(StockTokenRegistry.TokenAlreadyRegistered.selector);
        registry.upsertAsset(keccak256("NVDA"), address(aapl), keccak256("nvda"), "NVDA", "Nvidia", true);
        vm.stopPrank();
    }

    function test_publisher_commits_one_active_family_result_per_day() public {
        uint256 day = block.timestamp / 1 days - 1;
        bytes32 tallyHash = keccak256("sorted-public-family-votes");
        vm.prank(ballotPublisher);
        registry.publishBallot(day, AAPL_KEY, tallyHash);

        (bytes32 assetKey, address token, string memory ticker, bytes32 committedTally, bool active) =
            registry.resolveBallot(day);
        assertEq(assetKey, AAPL_KEY);
        assertEq(token, address(aapl));
        assertEq(ticker, "AAPL");
        assertEq(committedTally, tallyHash);
        assertTrue(active);

        vm.prank(ballotPublisher);
        vm.expectRevert(StockTokenRegistry.BallotAlreadyPublished.selector);
        registry.publishBallot(day, TSLA_KEY, keccak256("rewrite"));
    }

    function test_a_published_ballot_cannot_silently_follow_a_later_token_rotation() public {
        uint256 day = block.timestamp / 1 days - 1;
        vm.prank(ballotPublisher);
        registry.publishBallot(day, AAPL_KEY, keccak256("tally"));

        MockRobinhoodStockToken replacement = new MockRobinhoodStockToken("Apple Stock Token v2", "AAPL");
        vm.prank(safe);
        registry.upsertAsset(AAPL_KEY, address(replacement), AAPL_UID_HASH, "AAPL", "Apple", true);

        (, address token,,, bool active) = registry.resolveBallot(day);
        assertEq(token, address(aapl), "a registry rotation changed an already-published ballot");
        assertFalse(active, "a ballot for a superseded token must fail closed until a new vote");
    }

    function test_ballot_refuses_strangers_future_days_and_inactive_assets() public {
        uint256 yesterday = block.timestamp / 1 days - 1;
        vm.expectRevert(StockTokenRegistry.NotPublisher.selector);
        registry.publishBallot(yesterday, AAPL_KEY, keccak256("x"));

        vm.prank(ballotPublisher);
        vm.expectRevert(StockTokenRegistry.DayNotClosed.selector);
        registry.publishBallot(block.timestamp / 1 days, AAPL_KEY, keccak256("x"));

        vm.prank(safe);
        registry.setAssetActive(AAPL_KEY, false);
        vm.prank(ballotPublisher);
        vm.expectRevert(StockTokenRegistry.AssetNotActive.selector);
        registry.publishBallot(yesterday, AAPL_KEY, keccak256("x"));
    }

    function test_buyer_resolves_the_ballot_token_and_delivers_it_to_stock_vault() public {
        uint256 day = block.timestamp / 1 days - 1;
        vm.prank(ballotPublisher);
        registry.publishBallot(day, TSLA_KEY, keccak256("tally"));

        vm.prank(buyKeeper);
        (address token, uint256 units) = buyer.buy(day, 1 ether, 24e18, hex"1234");

        assertEq(token, address(tsla), "the keeper never supplied a token; the ballot resolved TSLA");
        assertEq(units, 25e18);
        assertEq(adapter.lastToken(), address(tsla), "the adapter was instructed to buy only the resolved token");
        assertEq(adapter.lastRecipient(), stockVault, "the acquired stock went directly to StockVault");
        assertEq(adapter.lastValue(), 1 ether);
        assertEq(tsla.balanceOf(stockVault), 25e18);
        assertEq(aapl.balanceOf(stockVault), 0);
        assertEq(buyer.spentOnDay(block.timestamp / 1 days), 1 ether);
        assertTrue(buyer.purchased(day));
    }

    function test_buy_is_one_shot_and_fails_closed_if_asset_is_later_disabled() public {
        uint256 day = block.timestamp / 1 days - 1;
        vm.prank(ballotPublisher);
        registry.publishBallot(day, AAPL_KEY, keccak256("tally"));

        vm.prank(safe);
        registry.setAssetActive(AAPL_KEY, false);
        vm.prank(buyKeeper);
        vm.expectRevert(RwaStockBuyer.BallotAssetInactive.selector);
        buyer.buy(day, 1 ether, 1, "");
        assertFalse(buyer.purchased(day));

        vm.prank(safe);
        registry.setAssetActive(AAPL_KEY, true);
        vm.prank(buyKeeper);
        buyer.buy(day, 1 ether, 1, "");
        vm.prank(buyKeeper);
        vm.expectRevert(RwaStockBuyer.AlreadyPurchased.selector);
        buyer.buy(day, 1 ether, 1, "");
    }

    function test_slippage_failure_rolls_back_latch_and_spend() public {
        uint256 day = block.timestamp / 1 days - 1;
        vm.prank(ballotPublisher);
        registry.publishBallot(day, AAPL_KEY, keccak256("tally"));
        adapter.setUnitsOut(9e18);

        vm.prank(buyKeeper);
        vm.expectRevert(RwaStockBuyer.InsufficientOutput.selector);
        buyer.buy(day, 1 ether, 10e18, "");

        assertFalse(buyer.purchased(day));
        assertEq(buyer.spentOnDay(block.timestamp / 1 days), 0);
        assertEq(aapl.balanceOf(stockVault), 0);
    }

    function test_keeper_cannot_weaken_the_independent_quote_floor() public {
        uint256 day = block.timestamp / 1 days - 1;
        vm.prank(ballotPublisher);
        registry.publishBallot(day, AAPL_KEY, keccak256("tally"));
        adapter.setUnitsOut(4e18);

        vm.prank(buyKeeper);
        vm.expectRevert(RwaStockBuyer.InsufficientOutput.selector);
        buyer.buy(day, 1 ether, 1, "");

        assertFalse(buyer.purchased(day));
        assertEq(buyer.spentOnDay(block.timestamp / 1 days), 0);

        quoteOracle.set(5e18, block.timestamp - 1 hours - 1);
        vm.prank(buyKeeper);
        vm.expectRevert(RwaStockBuyer.QuoteStale.selector);
        buyer.buy(day, 1 ether, 100e18, "");
    }

    function test_keeper_cannot_choose_an_older_closed_ballot() public {
        uint256 olderDay = block.timestamp / 1 days - 2;
        vm.prank(ballotPublisher);
        registry.publishBallot(olderDay, AAPL_KEY, keccak256("older-tally"));

        vm.prank(buyKeeper);
        vm.expectRevert(bytes4(keccak256("UnexpectedBallotDay()")));
        buyer.buy(olderDay, 1 ether, 1, "");

        assertFalse(buyer.purchased(olderDay), "an out-of-cadence ballot consumed its latch");
        assertEq(buyer.spentOnDay(block.timestamp / 1 days), 0, "an out-of-cadence ballot consumed budget");
        assertEq(aapl.balanceOf(stockVault), 0, "an out-of-cadence ballot bought stock");
    }

    function test_only_safe_can_configure_and_disabling_the_oracle_blocks_reactivation() public {
        vm.expectRevert();
        buyer.setQuoteOracle(address(quoteOracle), 1 hours);

        vm.startPrank(safe);
        buyer.pause();
        buyer.setQuoteOracle(address(0), 0);
        assertEq(buyer.quoteOracle(), address(0));
        vm.expectRevert(RwaStockBuyer.ConfigurationIncomplete.selector);
        buyer.unpause();
        vm.stopPrank();
    }

    function test_keeper_is_bounded_by_pause_balance_and_daily_cap() public {
        uint256 day = block.timestamp / 1 days - 1;
        vm.prank(ballotPublisher);
        registry.publishBallot(day, TSLA_KEY, keccak256("tally"));

        vm.prank(buyKeeper);
        vm.expectRevert(RwaStockBuyer.DailyCapExceeded.selector);
        buyer.buy(day, 6 ether, 1, "");
        assertFalse(buyer.purchased(day), "a cap failure consumed the ballot latch");

        vm.prank(buyKeeper);
        buyer.buy(day, 4 ether, 1, "");

        vm.prank(safe);
        buyer.pause();
        vm.prank(buyKeeper);
        vm.expectRevert();
        buyer.buy(day, 1 ether, 1, "");
    }

    function test_buyer_is_paused_at_birth() public {
        RwaStockBuyer newborn =
            new RwaStockBuyer(safe, buyKeeper, address(registry), address(adapter), stockVault, 1 ether);
        assertTrue(newborn.paused(), "an incompletely configured buyer must deploy paused");
    }

    function test_live_dependencies_cannot_be_rotated() public {
        MockStockSwapAdapter replacementAdapter = new MockStockSwapAdapter(1);
        MockStockQuoteOracle replacementOracle = new MockStockQuoteOracle(1);
        vm.startPrank(safe);
        vm.expectRevert();
        buyer.setKeeper(makeAddr("replacement keeper"));
        vm.expectRevert();
        buyer.setAdapter(address(replacementAdapter));
        vm.expectRevert();
        buyer.setQuoteOracle(address(replacementOracle), 1 hours);
        vm.stopPrank();
    }

    function test_incomplete_configuration_cannot_be_unpaused() public {
        RwaStockBuyer disabled = new RwaStockBuyer(safe, address(0), address(registry), address(0), stockVault, 1 ether);
        if (!disabled.paused()) {
            vm.prank(safe);
            disabled.pause();
        }

        vm.prank(safe);
        vm.expectRevert();
        disabled.unpause();
    }

    function test_constructor_rejects_an_unbounded_daily_budget() public {
        vm.expectRevert();
        new RwaStockBuyer(safe, buyKeeper, address(registry), address(adapter), stockVault, 0);
    }

    function test_adapter_and_quote_oracle_must_have_bytecode() public {
        RwaStockBuyer disabled = new RwaStockBuyer(safe, address(0), address(registry), address(0), stockVault, 1 ether);
        if (!disabled.paused()) {
            vm.prank(safe);
            disabled.pause();
        }

        vm.startPrank(safe);
        vm.expectRevert();
        disabled.setAdapter(makeAddr("adapter EOA"));
        vm.expectRevert();
        disabled.setQuoteOracle(makeAddr("oracle EOA"), 1 hours);
        vm.stopPrank();
    }

    function test_buyer_registry_and_stock_vault_must_have_bytecode() public {
        vm.expectRevert();
        new RwaStockBuyer(safe, buyKeeper, makeAddr("registry EOA"), address(adapter), stockVault, 1 ether);

        vm.expectRevert();
        new RwaStockBuyer(safe, buyKeeper, address(registry), address(adapter), makeAddr("vault EOA"), 1 ether);
    }

    function test_registry_rejects_a_token_address_without_bytecode() public {
        vm.prank(safe);
        vm.expectRevert();
        registry.upsertAsset(
            keccak256("NVDA"), makeAddr("NVDA EOA"), keccak256("robinhood-nvda-asset-id"), "NVDA", "Nvidia", true
        );
    }
}
