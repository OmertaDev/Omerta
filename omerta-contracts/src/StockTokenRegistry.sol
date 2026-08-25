// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title StockTokenRegistry — OMERTÀ's approved Robinhood Stock Token catalog and ballot oracle.
/// @notice Bridges two authority domains without pretending they are the same system:
///         - Robinhood publishes the canonical Stock Token asset identity/address for chain 4663;
///         - OMERTÀ's Safe curates which of those assets the game is willing and legally able to buy;
///         - the server-authoritative Commission tallies family votes and an isolated publisher commits
///           one closed-day result plus a hash of the public tally here.
///
///         The registry cannot call Robinhood's HTTP API. An off-chain catalog synchronizer proposes
///         changes from `GET https://api.robinhood.com/rhj/assets`; the Safe verifies and executes them.
///         The automated buyer therefore resolves a token address from TWO immutable references — the
///         published ballot day and this Safe-approved registry — and never trusts a ticker/address sent
///         by the buy keeper.
contract StockTokenRegistry is Ownable2Step {
    uint256 public constant ROBINHOOD_CHAIN_ID = 4663;

    struct Asset {
        address token;
        bytes32 robinhoodAssetIdHash;
        string ticker;
        string name;
        bool active;
    }

    struct Ballot {
        bytes32 assetKey;
        bytes32 tallyHash;
        uint64 publishedAt;
    }

    address public publisher;
    bytes32[] private _assetKeys;
    mapping(bytes32 => Asset) private _assets;
    mapping(address => bytes32) public keyForToken;
    mapping(bytes32 => bytes32) public keyForRobinhoodAssetIdHash;
    mapping(uint256 => Ballot) public ballots;
    /// @notice Token identity snapshotted when each immutable ballot is published. Kept outside
    ///         `Ballot` so the existing public getter ABI remains stable for indexers.
    mapping(uint256 => address) public ballotToken;

    event PublisherSet(address indexed publisher);
    event AssetUpserted(
        bytes32 indexed assetKey,
        address indexed token,
        bytes32 indexed robinhoodAssetIdHash,
        string ticker,
        string name,
        bool active
    );
    event AssetActiveSet(bytes32 indexed assetKey, bool active);
    event BallotPublished(uint256 indexed day, bytes32 indexed assetKey, address indexed token, bytes32 tallyHash);

    error NotPublisher();
    error ZeroAddress();
    error EmptyValue();
    error TickerKeyMismatch();
    error TokenAlreadyRegistered();
    error RobinhoodAssetAlreadyRegistered();
    error AssetNotFound();
    error AssetNotActive();
    error DayNotClosed();
    error BallotAlreadyPublished();
    error BallotNotFound();

    modifier onlyPublisher() {
        if (msg.sender != publisher || publisher == address(0)) revert NotPublisher();
        _;
    }

    constructor(address owner_, address publisher_) Ownable(owner_) {
        publisher = publisher_;
        emit PublisherSet(publisher_);
    }

    /// @notice The canonical key is the keccak hash of the uppercase ticker shown to voters.
    function keyOf(string memory ticker) public pure returns (bytes32) {
        return keccak256(bytes(ticker));
    }

    /// @notice Add or update an approved catalog entry. Only the Safe can turn an observed Robinhood
    ///         asset into a candidate. `robinhoodAssetIdHash` binds the API's stable id without storing
    ///         a long provider string on-chain; `token` is the official chain-4663 deployment address.
    function upsertAsset(
        bytes32 assetKey,
        address token,
        bytes32 robinhoodAssetIdHash,
        string calldata ticker,
        string calldata name,
        bool active
    ) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (
            assetKey == bytes32(0) || robinhoodAssetIdHash == bytes32(0) || bytes(ticker).length == 0
                || bytes(name).length == 0
        ) revert EmptyValue();
        if (keyOf(ticker) != assetKey) revert TickerKeyMismatch();

        bytes32 tokenOwner = keyForToken[token];
        if (tokenOwner != bytes32(0) && tokenOwner != assetKey) revert TokenAlreadyRegistered();
        bytes32 providerOwner = keyForRobinhoodAssetIdHash[robinhoodAssetIdHash];
        if (providerOwner != bytes32(0) && providerOwner != assetKey) {
            revert RobinhoodAssetAlreadyRegistered();
        }

        Asset storage current = _assets[assetKey];
        bool isNew = current.token == address(0);
        if (isNew) {
            _assetKeys.push(assetKey);
        } else {
            if (current.token != token) delete keyForToken[current.token];
            if (current.robinhoodAssetIdHash != robinhoodAssetIdHash) {
                delete keyForRobinhoodAssetIdHash[current.robinhoodAssetIdHash];
            }
        }

        _assets[assetKey] = Asset({
            token: token, robinhoodAssetIdHash: robinhoodAssetIdHash, ticker: ticker, name: name, active: active
        });
        keyForToken[token] = assetKey;
        keyForRobinhoodAssetIdHash[robinhoodAssetIdHash] = assetKey;
        emit AssetUpserted(assetKey, token, robinhoodAssetIdHash, ticker, name, active);
    }

    function setAssetActive(bytes32 assetKey, bool active) external onlyOwner {
        Asset storage asset = _assets[assetKey];
        if (asset.token == address(0)) revert AssetNotFound();
        asset.active = active;
        emit AssetActiveSet(assetKey, active);
    }

    /// @notice A zero publisher deliberately disables automatic ballot publication.
    function setPublisher(address publisher_) external onlyOwner {
        publisher = publisher_;
        emit PublisherSet(publisher_);
    }

    function assetCount() external view returns (uint256) {
        return _assetKeys.length;
    }

    function assetKeyAt(uint256 index) external view returns (bytes32) {
        return _assetKeys[index];
    }

    function getAsset(bytes32 assetKey) external view returns (Asset memory) {
        Asset memory asset = _assets[assetKey];
        if (asset.token == address(0)) revert AssetNotFound();
        return asset;
    }

    /// @notice Commit the final result for a UTC day only after that day has closed. One immutable row
    ///         per day makes retries safe and prevents a compromised publisher rewriting history.
    function publishBallot(uint256 day, bytes32 assetKey, bytes32 tallyHash) external onlyPublisher {
        if (day >= block.timestamp / 1 days) revert DayNotClosed();
        if (ballots[day].publishedAt != 0) revert BallotAlreadyPublished();
        Asset storage asset = _assets[assetKey];
        if (asset.token == address(0) || !asset.active) revert AssetNotActive();

        ballots[day] = Ballot({assetKey: assetKey, tallyHash: tallyHash, publishedAt: uint64(block.timestamp)});
        ballotToken[day] = asset.token;
        emit BallotPublished(day, assetKey, asset.token, tallyHash);
    }

    /// @notice Resolve the exact address committed at publication. `active` is still live: the Safe
    ///         can emergency-disable that token after a vote. Rotating the catalog entry also makes
    ///         the old ballot inactive rather than silently redirecting it to a token nobody voted for.
    function resolveBallot(uint256 day)
        external
        view
        returns (bytes32 assetKey, address token, string memory ticker, bytes32 tallyHash, bool active)
    {
        Ballot memory ballot = ballots[day];
        if (ballot.publishedAt == 0) revert BallotNotFound();
        Asset storage asset = _assets[ballot.assetKey];
        token = ballotToken[day];
        active = asset.active && asset.token == token;
        return (ballot.assetKey, token, asset.ticker, ballot.tallyHash, active);
    }
}
