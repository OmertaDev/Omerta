// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IStockTokenRegistryV2} from "./interfaces/IStockTokenRegistryV2.sol";

/// @title StockTokenRegistryV2
/// @notice Safe-curated immutable Stock Token versions and exact closed-day ballot snapshots.
contract StockTokenRegistryV2 is IStockTokenRegistryV2, Ownable2Step {
    uint256 public constant override supportedChainId = 4663;
    uint256 private constant ACTIVATION_TTL = 7 days;
    bytes32 private constant CONFLICT_REASON = keccak256("ASSET_VERSION_CONFLICT");

    address public override publisher;
    uint256 public override catalogVersion;
    mapping(bytes32 => uint256) public override activationGeneration;
    mapping(uint256 => uint256) public override ballotActivationGeneration;

    bytes32[] private _versionKeys;
    mapping(bytes32 => AssetVersion) private _versions;
    mapping(bytes32 => bytes32) public override activeVersionForTickerHash;
    mapping(address => bytes32) public override activeVersionForToken;
    mapping(bytes32 => bytes32) public override activeVersionForProviderIdHash;
    mapping(uint256 => Ballot) private _ballots;

    modifier onlyPublisher() {
        if (publisher == address(0) || msg.sender != publisher) revert NotPublisher();
        _;
    }

    constructor(address owner_, address publisher_) Ownable(owner_) {
        publisher = publisher_;
        emit PublisherSet(publisher_);
    }

    function assetVersionKey(string memory normalizedTicker, address token, bytes32 robinhoodAssetIdHash)
        public
        pure
        override
        returns (bytes32)
    {
        return keccak256(abi.encode(supportedChainId, keccak256(bytes(normalizedTicker)), token, robinhoodAssetIdHash));
    }

    function activateVersion(Activation calldata activation) external override onlyOwner returns (bytes32 versionKey) {
        _validateActivation(activation);
        bytes32 tickerHash = keccak256(bytes(activation.ticker));
        versionKey =
            keccak256(abi.encode(supportedChainId, tickerHash, activation.token, activation.robinhoodAssetIdHash));

        AssetVersion storage target = _versions[versionKey];
        if (target.chainId == 0) {
            uint8 actualDecimals = IERC20Metadata(activation.token).decimals();
            if (actualDecimals != activation.tokenDecimals) {
                revert DecimalsMismatch(actualDecimals, activation.tokenDecimals);
            }
            uint64 registeredAt = uint64(block.timestamp);
            target.chainId = supportedChainId;
            target.tickerHash = tickerHash;
            target.token = activation.token;
            target.robinhoodAssetIdHash = activation.robinhoodAssetIdHash;
            target.ticker = activation.ticker;
            target.name = activation.name;
            target.tokenDecimals = activation.tokenDecimals;
            target.registeredAt = registeredAt;
            _versionKeys.push(versionKey);
            emit AssetVersionRegistered(
                versionKey,
                tickerHash,
                activation.token,
                activation.robinhoodAssetIdHash,
                activation.ticker,
                activation.name,
                activation.tokenDecimals,
                registeredAt
            );
        } else if (
            target.chainId != supportedChainId || target.tickerHash != tickerHash || target.token != activation.token
                || target.robinhoodAssetIdHash != activation.robinhoodAssetIdHash
                || keccak256(bytes(target.ticker)) != keccak256(bytes(activation.ticker))
                || keccak256(bytes(target.name)) != keccak256(bytes(activation.name))
                || target.tokenDecimals != activation.tokenDecimals
        ) {
            revert ImmutableVersionMismatch();
        }

        uint256 nextCatalogVersion = catalogVersion + 1;
        bytes32 tickerConflict = activeVersionForTickerHash[tickerHash];
        bytes32 tokenConflict = activeVersionForToken[activation.token];
        bytes32 providerConflict = activeVersionForProviderIdHash[activation.robinhoodAssetIdHash];

        _deactivateConflict(tickerConflict, versionKey, nextCatalogVersion);
        if (tokenConflict != tickerConflict) {
            _deactivateConflict(tokenConflict, versionKey, nextCatalogVersion);
        }
        if (providerConflict != tickerConflict && providerConflict != tokenConflict) {
            _deactivateConflict(providerConflict, versionKey, nextCatalogVersion);
        }

        target.active = true;
        target.activatedAt = uint64(block.timestamp);
        target.deactivatedAt = 0;
        ++activationGeneration[versionKey];
        activeVersionForTickerHash[tickerHash] = versionKey;
        activeVersionForToken[activation.token] = versionKey;
        activeVersionForProviderIdHash[activation.robinhoodAssetIdHash] = versionKey;
        catalogVersion = nextCatalogVersion;

        emit AssetVersionActivated(
            versionKey,
            activation.evidenceHash,
            activation.reviewId,
            activation.approvedAt,
            activation.validUntil,
            nextCatalogVersion
        );
    }

    function deactivateVersion(bytes32 versionKey, bytes32 reasonHash) external override onlyOwner {
        if (reasonHash == bytes32(0)) revert EmptyDeactivationReason();
        AssetVersion storage version = _versions[versionKey];
        if (version.chainId == 0) revert VersionNotFound();
        if (!version.active) return;

        uint256 nextCatalogVersion = catalogVersion + 1;
        _deactivate(versionKey, reasonHash, nextCatalogVersion);
        catalogVersion = nextCatalogVersion;
    }

    function publishBallot(
        uint256 day,
        bytes32 versionKey,
        bytes32 tallyHash,
        uint256 catalogVersion_,
        uint256 maxEthWei,
        uint64 purchaseUntil
    ) external override onlyPublisher {
        if (day >= block.timestamp / 1 days) revert DayNotClosed();
        if (_ballots[day].assetVersionKey != bytes32(0)) revert BallotAlreadyPublished();
        AssetVersion storage version = _versions[versionKey];
        if (!_isExactlyActive(versionKey, version)) revert VersionNotActive();
        uint256 closeBoundary = (day + 1) * 1 days;
        if (uint256(version.activatedAt) >= closeBoundary) revert VersionActivatedAfterDayClose();
        if (maxEthWei == 0) revert EmptyMaxEthWei();
        if (purchaseUntil <= block.timestamp) revert InvalidPurchaseUntil();

        uint64 publishedAt = uint64(block.timestamp);
        _ballots[day] = Ballot({
            assetVersionKey: versionKey,
            token: version.token,
            tokenDecimals: version.tokenDecimals,
            tallyHash: tallyHash,
            catalogVersion: catalogVersion_,
            maxEthWei: maxEthWei,
            purchaseUntil: purchaseUntil,
            publishedAt: publishedAt
        });
        ballotActivationGeneration[day] = activationGeneration[versionKey];
        emit BallotPublished(
            day,
            versionKey,
            version.token,
            version.tokenDecimals,
            tallyHash,
            catalogVersion_,
            maxEthWei,
            purchaseUntil,
            publishedAt
        );
    }

    function resolveBallot(uint256 day)
        external
        view
        override
        returns (
            bytes32 versionKey,
            address token,
            uint8 tokenDecimals,
            bytes32 tallyHash,
            uint256 catalogVersion_,
            uint256 maxEthWei,
            uint64 purchaseUntil,
            bool active
        )
    {
        Ballot memory ballot = _ballots[day];
        if (ballot.assetVersionKey == bytes32(0)) revert BallotNotFound();
        AssetVersion storage version = _versions[ballot.assetVersionKey];
        versionKey = ballot.assetVersionKey;
        token = ballot.token;
        tokenDecimals = ballot.tokenDecimals;
        tallyHash = ballot.tallyHash;
        catalogVersion_ = ballot.catalogVersion;
        maxEthWei = ballot.maxEthWei;
        purchaseUntil = ballot.purchaseUntil;
        active = _isLiveBallot(day, ballot.assetVersionKey, version);
    }

    function setPublisher(address publisher_) external override onlyOwner {
        publisher = publisher_;
        emit PublisherSet(publisher_);
    }

    function versionCount() external view override returns (uint256) {
        return _versionKeys.length;
    }

    function versionKeyAt(uint256 index) external view override returns (bytes32) {
        return _versionKeys[index];
    }

    function getVersion(bytes32 versionKey) external view override returns (AssetVersion memory) {
        AssetVersion memory version = _versions[versionKey];
        if (version.chainId == 0) revert VersionNotFound();
        return version;
    }

    function getBallot(uint256 day) external view override returns (Ballot memory) {
        Ballot memory ballot = _ballots[day];
        if (ballot.assetVersionKey == bytes32(0)) revert BallotNotFound();
        return ballot;
    }

    function _validateActivation(Activation calldata activation) private view {
        if (activation.token == address(0)) revert ZeroAddress();
        if (activation.token.code.length == 0) revert ContractRequired(activation.token);
        if (!_validTicker(bytes(activation.ticker))) revert InvalidTicker();
        if (activation.robinhoodAssetIdHash == bytes32(0)) revert EmptyProviderId();
        if (activation.evidenceHash == bytes32(0)) revert EmptyEvidence();
        if (activation.reviewId == bytes32(0)) revert EmptyReviewId();
        if (bytes(activation.name).length == 0) revert EmptyName();
        if (uint256(activation.validUntil) != uint256(activation.approvedAt) + ACTIVATION_TTL) {
            revert InvalidActivationTtl();
        }
        if (block.timestamp < activation.approvedAt) revert ApprovalNotYetValid();
        if (block.timestamp >= activation.validUntil) revert ApprovalStale();
    }

    function _validTicker(bytes memory ticker) private pure returns (bool) {
        if (ticker.length == 0 || ticker.length > 24) return false;
        for (uint256 i; i < ticker.length; ++i) {
            bytes1 character = ticker[i];
            bool upper = character >= 0x41 && character <= 0x5A;
            bool digit = character >= 0x30 && character <= 0x39;
            bool punctuation = character == 0x2E || character == 0x5F || character == 0x2D;
            if (!upper && !digit && !punctuation) return false;
        }
        return true;
    }

    function _deactivateConflict(bytes32 conflictKey, bytes32 targetKey, uint256 nextCatalogVersion) private {
        if (conflictKey != bytes32(0) && conflictKey != targetKey) {
            _deactivate(conflictKey, CONFLICT_REASON, nextCatalogVersion);
        }
    }

    function _deactivate(bytes32 versionKey, bytes32 reasonHash, uint256 nextCatalogVersion) private {
        AssetVersion storage version = _versions[versionKey];
        if (!version.active) return;
        version.active = false;
        version.deactivatedAt = uint64(block.timestamp);
        if (activeVersionForTickerHash[version.tickerHash] == versionKey) {
            delete activeVersionForTickerHash[version.tickerHash];
        }
        if (activeVersionForToken[version.token] == versionKey) {
            delete activeVersionForToken[version.token];
        }
        if (activeVersionForProviderIdHash[version.robinhoodAssetIdHash] == versionKey) {
            delete activeVersionForProviderIdHash[version.robinhoodAssetIdHash];
        }
        emit AssetVersionDeactivated(versionKey, reasonHash, uint64(block.timestamp), nextCatalogVersion);
    }

    function _isExactlyActive(bytes32 versionKey, AssetVersion storage version) private view returns (bool) {
        return version.active && activeVersionForTickerHash[version.tickerHash] == versionKey
            && activeVersionForToken[version.token] == versionKey
            && activeVersionForProviderIdHash[version.robinhoodAssetIdHash] == versionKey;
    }

    function _isLiveBallot(uint256 day, bytes32 versionKey, AssetVersion storage version) private view returns (bool) {
        return _isExactlyActive(versionKey, version)
            && activationGeneration[versionKey] == ballotActivationGeneration[day];
    }
}
