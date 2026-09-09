// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IOmrOracle} from "./IOmrOracle.sol";
import {GenesisProceedsSplitter} from "./GenesisProceedsSplitter.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

// ABI-exact copies of the pinned LBP v3.1.1 migration tuples. Dynamic fields remain bytes;
// their committed encodings below admit only the published full-range genesis policy.
struct GenesisPoolParameters { uint24 fee; int24 tickSpacing; address hook; }
struct GenesisMigratorParameters {
    address token; address currency; uint64 migrationBlock; uint128 reservedTokenAmountForLP;
    address recipient; address positionRecipient; GenesisPoolParameters poolParameters;
    bytes positionDefinitions; bytes lpAllocationSchedule;
}

interface IGenesisAuction {
    function token() external view returns (address);
    function currency() external view returns (address);
    function fundsRecipient() external view returns (address);
    function tokensRecipient() external view returns (address);
    function startBlock() external view returns (uint64);
    function endBlock() external view returns (uint64);
    function sweepUnsoldTokensBlock() external view returns (uint256);
    function checkpoint() external;
    function sweepUnsoldTokens() external;
}
interface IGenesisStrategy {
    function registeredPoolIds(bytes32 pool) external view returns (address);
    function initializers(address auction) external view returns (GenesisMigratorParameters memory);
    function migrate(address auction) external;
}
interface IGenesisFoundation {
    function omr() external view returns (address);
    function poolId() external view returns (bytes32);
    function poolManager() external view returns (address);
    function oracle() external view returns (address);
    function positionId() external view returns (uint256);
    function genesisController() external view returns (address);
    function adoptGenesisFoundation(uint256 id) external;
    function healthy() external view returns (bool);
    function activationTimestamp() external view returns (uint256);
    function warmup() external view returns (uint256);
    function emergencyLatched() external view returns (bool);
}
interface IGenesisArbSys { function arbBlockNumber() external view returns (uint256); }

/// @notice Permissionless progression of one owner-committed launch. No arbitrary execution or
///         mutable payment destinations. Core ownership stays with the Safe throughout the launch.
/// @dev Initial setup installs the Bond health guard/oracle/caps and the controller on the POL
///      vault before the auction. This contract never grants itself token minting or Safe powers.
contract GenesisLifecycleController is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    enum Phase { Unbound, Auction, Migration, Failed, OracleWarmup, Live }
    IGenesisStrategy public immutable strategy;
    GenesisProceedsSplitter public immutable splitter;
    IGenesisFoundation public immutable foundation;
    IOmrOracle public immutable oracle;
    IERC20 public immutable omr;
    address public immutable treasury;
    bytes32 public immutable poolId;
    uint256 public immutable maxOracleAge;
    uint256 public immutable chainId;
    bytes32 public immutable strategyCodeHash;
    bytes32 public immutable splitterCodeHash;
    bytes32 public immutable foundationCodeHash;
    bytes32 public immutable oracleCodeHash;
    bytes32 public immutable omrCodeHash;
    bytes32 public immutable poolManagerCodeHash;
    bool public immutable usesArbSys;
    IGenesisAuction public auction;
    bytes32 public auctionCodeHash;
    uint256 public migrationBlock;
    bool public failed;
    bool public stopped;
    event AuctionBound(address indexed auction, uint256 migrationBlock, bytes32 runtimeHash);
    event MigrationObserved(bool succeeded);
    event UnsoldReturned(uint256 amount);
    event Stopped(bool stopped);
    error InvalidConfiguration();
    error WrongPhase();
    error DependencyChanged();

    constructor(address owner_, IGenesisStrategy strategy_, GenesisProceedsSplitter splitter_,
        IGenesisFoundation foundation_, IOmrOracle oracle_, IERC20 omr_, address treasury_, uint256 maxOracleAge_)
        Ownable(owner_)
    {
        if (address(strategy_).code.length == 0 || address(splitter_).code.length == 0
            || address(foundation_).code.length == 0 || address(oracle_).code.length == 0
            || address(omr_).code.length == 0 || treasury_ == address(0) || treasury_ == address(this)
            || maxOracleAge_ == 0 || foundation_.omr() != address(omr_)
            || treasury_ != splitter_.treasuryRecipient()
            || foundation_.poolManager() != address(splitter_.poolManager())
            || foundation_.oracle() != address(oracle_)
            || foundation_.poolId() != PoolId.unwrap(splitter_.canonicalPoolId())) revert InvalidConfiguration();
        strategy = strategy_; splitter = splitter_; foundation = foundation_; oracle = oracle_;
        omr = omr_; treasury = treasury_; poolId = foundation_.poolId(); maxOracleAge = maxOracleAge_;
        chainId = block.chainid;
        strategyCodeHash = address(strategy_).codehash; splitterCodeHash = address(splitter_).codehash;
        foundationCodeHash = address(foundation_).codehash; oracleCodeHash = address(oracle_).codehash;
        omrCodeHash = address(omr_).codehash;
        poolManagerCodeHash = address(splitter_.poolManager()).codehash;
        // Match the pinned BlockNumberish constructor: recognize any Orbit chain by the
        // precompile's deployed code and exact successful 32-byte response, then pin that mode.
        (bool ok, bytes memory data) = address(100).staticcall(abi.encodeCall(IGenesisArbSys.arbBlockNumber, ()));
        usesArbSys = address(100).code.length != 0 && ok && data.length == 32;
    }

    /// @notice One-time commitment after atomic CCA creation, before bidding begins.
    ///         The auction's unsold token destination must already be this controller.
    function bindAuction(IGenesisAuction a) external onlyOwner {
        if (!_valid()) revert DependencyChanged();
        if (address(auction) != address(0) || address(a).code.length == 0 || _clock() >= a.startBlock()
            || a.endBlock() < a.startBlock() || a.token() != address(omr) || a.currency() != address(0)
            || a.tokensRecipient() != address(this) || a.fundsRecipient() != address(strategy)
            || strategy.registeredPoolIds(poolId) != address(a)
            || foundation.genesisController() != address(this)) revert InvalidConfiguration();
        GenesisMigratorParameters memory p = strategy.initializers(address(a));
        PoolKey memory key = PoolKey(Currency.wrap(p.currency), Currency.wrap(p.token),
            p.poolParameters.fee, p.poolParameters.tickSpacing, IHooks(p.poolParameters.hook));
        if (p.token != address(omr) || p.currency != address(0)
            || p.recipient != address(splitter) || p.positionRecipient != address(foundation)
            || PoolId.unwrap(key.toId()) != poolId || p.migrationBlock != uint256(a.endBlock()) + 1
            || p.reservedTokenAmountForLP != 1_653_750e18
            || keccak256(p.positionDefinitions) != keccak256(abi.encode(uint256(32), uint256(0)))
            || keccak256(p.lpAllocationSchedule)
                != keccak256(abi.encode(uint256(32), uint256(1), uint256(0), uint256(3_750_000))))
            revert InvalidConfiguration();
        auction = a; auctionCodeHash = address(a).codehash; migrationBlock = uint256(a.endBlock()) + 1;
        emit AuctionBound(address(a), migrationBlock, auctionCodeHash);
    }
    function setStopped(bool value) external onlyOwner { stopped = value; emit Stopped(value); }
    /// @notice A stopped controller is the auction's only authorized unsold-token recipient.
    /// Governance must remain able to resume recovery; two-step owner rotation remains available.
    function renounceOwnership() public view override onlyOwner { revert InvalidConfiguration(); }

    function currentBlock() external view returns (uint256) { return _clock(); }
    function _clock() private view returns (uint256) {
        // ArbSys returns the Orbit chain's block number, which may differ from block.number.
        if (usesArbSys) {
            (bool ok, bytes memory data) = address(100).staticcall(abi.encodeCall(IGenesisArbSys.arbBlockNumber, ()));
            if (!ok || data.length != 32) revert DependencyChanged();
            return abi.decode(data, (uint256));
        }
        return block.number;
    }
    function _valid() private view returns (bool) {
        return block.chainid == chainId && address(strategy).codehash == strategyCodeHash
            && address(splitter).codehash == splitterCodeHash && address(foundation).codehash == foundationCodeHash
            && address(oracle).codehash == oracleCodeHash
            && address(omr).codehash == omrCodeHash
            && address(splitter.poolManager()).codehash == poolManagerCodeHash
            && (address(auction) == address(0) || address(auction).codehash == auctionCodeHash);
    }
    function phase() public view returns (Phase) {
        if (!_valid() || failed || stopped || foundation.emergencyLatched()) return Phase.Failed;
        if (address(auction) == address(0)) return Phase.Unbound;
        if (_clock() < migrationBlock) return Phase.Auction;
        bool initialized = splitter.canonicalPoolInitialized();
        if (!initialized) return strategy.registeredPoolIds(poolId) == address(auction) ? Phase.Migration : Phase.Failed;
        if (!foundation.healthy()) return Phase.OracleWarmup;
        try oracle.consult() returns (uint256 price, uint256 updatedAt) {
            if (price == 0 || updatedAt > block.timestamp || block.timestamp - updatedAt > maxOracleAge
                || updatedAt < foundation.activationTimestamp() + foundation.warmup()) return Phase.OracleWarmup;
            return Phase.Live;
        } catch { return Phase.OracleWarmup; }
    }

    function checkpoint() external nonReentrant {
        _requireRunning();
        if (address(auction) == address(0) || _clock() < auction.startBlock()) revert WrongPhase();
        auction.checkpoint();
    }
    function migrate() external nonReentrant {
        _requireRunning();
        if (phase() != Phase.Migration) revert WrongPhase();
        strategy.migrate(address(auction));
        // The pinned strategy can return a SUCCESS receipt after its inner migration failed.
        // Pool initialization rolls back in that branch. Never equate tx.status with migration.
        bool success = splitter.canonicalPoolInitialized();
        if (strategy.registeredPoolIds(poolId) != address(0)) revert WrongPhase();
        failed = !success;
        emit MigrationObserved(success);
    }
    function acceptFoundation(uint256 positionId_) external nonReentrant {
        _requireRunning();
        if (address(auction) == address(0) || _clock() < migrationBlock || failed
            || !splitter.canonicalPoolInitialized() || strategy.registeredPoolIds(poolId) != address(0)) revert WrongPhase();
        // The vault validates actual PM custody, full-range pool identity, no subscription,
        // and the immutable floor. Supplying an ID grants no withdrawal or recipient authority.
        foundation.adoptGenesisFoundation(positionId_);
    }
    function sweepUnsoldTokens() external nonReentrant {
        _requireRunning();
        if (address(auction) == address(0) || _clock() < migrationBlock) revert WrongPhase();
        if (auction.sweepUnsoldTokensBlock() == 0) auction.sweepUnsoldTokens();
        uint256 amount = omr.balanceOf(address(this));
        if (amount != 0) omr.safeTransfer(treasury, amount);
        emit UnsoldReturned(amount);
    }
    function distributeResidual() external nonReentrant {
        _requireRunning();
        if (address(auction) == address(0) || _clock() < migrationBlock) revert WrongPhase();
        if (address(splitter).balance != 0) {
            if (splitter.canonicalPoolInitialized()) splitter.distributeResidual();
            else if (failed || strategy.registeredPoolIds(poolId) == address(0)) splitter.recoverFailedLaunch();
            else revert WrongPhase();
        }
        if (omr.balanceOf(address(splitter)) != 0) splitter.recoverToken(omr);
    }
    function _requireRunning() private view {
        if (!_valid()) revert DependencyChanged();
        if (stopped) revert WrongPhase();
    }
}
