// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IStockTokenRegistry {
    function resolveBallot(uint256 day)
        external
        view
        returns (bytes32 assetKey, address token, string memory ticker, bytes32 tallyHash, bool active);
}

/// @notice Venue-specific adapters implement the actual Robinhood Chain DEX call. The Safe approves
///         exactly one adapter at a time; the buyer still measures the canonical token arriving in the
///         vault, so arbitrary route data cannot make another asset count as a successful purchase.
interface IStockSwapAdapter {
    function buy(address token, address recipient, uint256 minUnits, bytes calldata routeData) external payable;
}

/// @notice Independent fair-value/slippage policy. Implementations may use a manipulation-resistant
///         TWAP, signed price network, or another audited source, but must return native token units
///         for this exact ETH input plus the observation time. It is deliberately separate from the
///         venue adapter and keeper: neither party spending the ETH gets to weaken the price floor.
interface IStockQuoteOracle {
    function minUnitsOut(address token, uint256 ethIn) external view returns (uint256 minUnits, uint256 observedAt);
}

/// @title RwaStockBuyer — ballot-bound, budget-capped Stock Token acquisition automation.
/// @notice A keeper can wake this contract, but cannot choose the asset, recipient, venue, or budget
///         wall. The closed family ballot selects an active Safe-approved registry entry; the Safe sets
///         the adapter, independent quote oracle and StockVault; the contract pays only its pre-funded
///         ETH and verifies the exact resolved token increased StockVault's balance by at least the
///         STRICTER of the keeper's floor and a fresh oracle-derived floor.
///
///         Smart contracts do not run on a clock by themselves. The untrusted keeper supplies timing,
///         the ballot day, a slippage floor, and adapter-specific route bytes. Every value-moving choice
///         remains bounded or derived on-chain, and a failed/reverted call consumes neither the daily cap
///         nor the ballot's one-shot latch.
contract RwaStockBuyer is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IStockTokenRegistry public immutable registry;
    address public immutable stockVault;
    address public keeper;
    address public adapter;
    address public quoteOracle;
    uint256 public maxQuoteAge;
    uint256 public dailyEthCap;

    mapping(uint256 => uint256) public spentOnDay;
    mapping(uint256 => bool) public purchased;

    event Funded(address indexed from, uint256 amount);
    event KeeperSet(address indexed keeper);
    event AdapterSet(address indexed adapter);
    event QuoteOracleSet(address indexed oracle, uint256 maxAge);
    event DailyEthCapSet(uint256 cap);
    event StockBought(
        uint256 indexed ballotDay,
        bytes32 indexed assetKey,
        address indexed token,
        uint256 ethSpent,
        uint256 units,
        address stockVault
    );
    event EthSwept(address indexed to, uint256 amount);
    event TokenSwept(address indexed token, address indexed to, uint256 amount);

    error NotKeeper();
    error ZeroAddress();
    error ZeroAmount();
    error AdapterDisabled();
    error QuoteOracleDisabled();
    error QuoteUnavailable();
    error QuoteStale();
    error UnexpectedBallotDay();
    error AlreadyPurchased();
    error BallotAssetInactive();
    error DailyCapExceeded();
    error InsufficientBalance();
    error InsufficientOutput();
    error EthTransferFailed();

    modifier onlyKeeper() {
        if (msg.sender != keeper || keeper == address(0)) revert NotKeeper();
        _;
    }

    constructor(
        address owner_,
        address keeper_,
        address registry_,
        address adapter_,
        address stockVault_,
        uint256 dailyEthCap_
    ) Ownable(owner_) {
        if (registry_ == address(0) || stockVault_ == address(0)) revert ZeroAddress();
        registry = IStockTokenRegistry(registry_);
        stockVault = stockVault_;
        keeper = keeper_;
        adapter = adapter_;
        dailyEthCap = dailyEthCap_;
        emit KeeperSet(keeper_);
        emit AdapterSet(adapter_);
        emit DailyEthCapSet(dailyEthCap_);
    }

    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }

    function setKeeper(address keeper_) external onlyOwner {
        keeper = keeper_; // zero deliberately disables buys
        emit KeeperSet(keeper_);
    }

    function setAdapter(address adapter_) external onlyOwner {
        adapter = adapter_; // zero deliberately disables buys
        emit AdapterSet(adapter_);
    }

    /// @notice Zero disables buying. A live oracle must have a nonzero freshness window so an old
    ///         fair price cannot become a keeper's permanent permission to trade through a moved market.
    function setQuoteOracle(address oracle_, uint256 maxAge_) external onlyOwner {
        if (oracle_ != address(0) && maxAge_ == 0) revert QuoteUnavailable();
        quoteOracle = oracle_;
        maxQuoteAge = oracle_ == address(0) ? 0 : maxAge_;
        emit QuoteOracleSet(oracle_, maxQuoteAge);
    }

    /// @notice Zero means unlimited, matching StockVault's cap convention. Production deployment
    ///         validation must choose a nonzero bound before the keeper is armed.
    function setDailyEthCap(uint256 cap) external onlyOwner {
        dailyEthCap = cap;
        emit DailyEthCapSet(cap);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function buy(uint256 ballotDay, uint256 ethIn, uint256 minUnits, bytes calldata routeData)
        external
        onlyKeeper
        nonReentrant
        whenNotPaused
        returns (address token, uint256 units)
    {
        if (adapter == address(0)) revert AdapterDisabled();
        if (ethIn == 0 || minUnits == 0) revert ZeroAmount();
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay == 0 || ballotDay != currentDay - 1) revert UnexpectedBallotDay();
        if (purchased[ballotDay]) revert AlreadyPurchased();

        (bytes32 assetKey, address resolvedToken) = _resolveActiveBallot(ballotDay);
        uint256 enforcedMinUnits = _enforcedMinimum(resolvedToken, ethIn, minUnits);
        if (address(this).balance < ethIn) revert InsufficientBalance();

        // Effects before interaction. Any adapter/output failure reverts these writes atomically.
        purchased[ballotDay] = true;
        _chargeDailyCap(ethIn);

        token = resolvedToken;
        units = _acquire(resolvedToken, ethIn, enforcedMinUnits, routeData);
        emit StockBought(ballotDay, assetKey, token, ethIn, units, stockVault);
    }

    function _resolveActiveBallot(uint256 ballotDay) private view returns (bytes32 assetKey, address token) {
        bool active;
        (assetKey, token,,, active) = registry.resolveBallot(ballotDay);
        if (!active || token == address(0)) revert BallotAssetInactive();
    }

    function _chargeDailyCap(uint256 ethIn) private {
        uint256 currentDay = block.timestamp / 1 days;
        uint256 newSpend = spentOnDay[currentDay] + ethIn;
        if (dailyEthCap != 0 && newSpend > dailyEthCap) revert DailyCapExceeded();
        spentOnDay[currentDay] = newSpend;
    }

    function _enforcedMinimum(address token, uint256 ethIn, uint256 keeperMinUnits) private view returns (uint256) {
        if (quoteOracle == address(0) || maxQuoteAge == 0) revert QuoteOracleDisabled();
        (uint256 oracleMinUnits, uint256 observedAt) = IStockQuoteOracle(quoteOracle).minUnitsOut(token, ethIn);
        if (oracleMinUnits == 0 || observedAt == 0 || observedAt > block.timestamp) revert QuoteUnavailable();
        if (block.timestamp - observedAt > maxQuoteAge) revert QuoteStale();
        return oracleMinUnits > keeperMinUnits ? oracleMinUnits : keeperMinUnits;
    }

    function _acquire(address token, uint256 ethIn, uint256 minUnits, bytes calldata routeData)
        private
        returns (uint256 units)
    {
        uint256 beforeBalance = IERC20(token).balanceOf(stockVault);
        IStockSwapAdapter(adapter).buy{value: ethIn}(token, stockVault, minUnits, routeData);
        uint256 afterBalance = IERC20(token).balanceOf(stockVault);
        if (afterBalance < beforeBalance || afterBalance - beforeBalance < minUnits) revert InsufficientOutput();
        return afterBalance - beforeBalance;
    }

    /// @notice The Safe can recover idle native currency while the buyer is paused/disabled or rotate
    ///         treasury funding. No keeper-accessible withdrawal path exists.
    function sweepEth(address payable to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert EthTransferFailed();
        emit EthSwept(to, amount);
    }

    /// @notice Recover tokens accidentally sent here. Purchased Stock Tokens go straight to StockVault.
    function sweepToken(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransfer(to, amount);
        emit TokenSwept(token, to, amount);
    }
}
