// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IStockTokenRegistryV2 {
    struct Activation {
        address token;
        bytes32 robinhoodAssetIdHash;
        string ticker;
        string name;
        uint8 tokenDecimals;
        bytes32 evidenceHash;
        bytes32 reviewId;
        uint64 approvedAt;
        uint64 validUntil;
    }

    struct AssetVersion {
        uint256 chainId;
        bytes32 tickerHash;
        address token;
        bytes32 robinhoodAssetIdHash;
        string ticker;
        string name;
        uint8 tokenDecimals;
        bool active;
        uint64 registeredAt;
        uint64 activatedAt;
        uint64 deactivatedAt;
    }

    struct Ballot {
        bytes32 assetVersionKey;
        address token;
        uint8 tokenDecimals;
        bytes32 tallyHash;
        uint256 catalogVersion;
        uint256 maxEthWei;
        uint64 purchaseUntil;
        uint64 publishedAt;
    }

    event PublisherSet(address indexed publisher);
    event AssetVersionRegistered(
        bytes32 indexed versionKey,
        bytes32 indexed tickerHash,
        address indexed token,
        bytes32 robinhoodAssetIdHash,
        string ticker,
        string name,
        uint8 tokenDecimals,
        uint64 registeredAt
    );
    event AssetVersionActivated(
        bytes32 indexed versionKey,
        bytes32 indexed evidenceHash,
        bytes32 indexed reviewId,
        uint64 approvedAt,
        uint64 validUntil,
        uint256 catalogVersion
    );
    event AssetVersionDeactivated(
        bytes32 indexed versionKey, bytes32 indexed reasonHash, uint64 deactivatedAt, uint256 catalogVersion
    );
    event BallotPublished(
        uint256 indexed day,
        bytes32 indexed versionKey,
        address indexed token,
        uint8 tokenDecimals,
        bytes32 tallyHash,
        uint256 catalogVersion,
        uint256 maxEthWei,
        uint64 purchaseUntil,
        uint64 publishedAt
    );

    error NotPublisher();
    error ZeroAddress();
    error ContractRequired(address target);
    error InvalidTicker();
    error EmptyProviderId();
    error EmptyEvidence();
    error EmptyReviewId();
    error EmptyName();
    error EmptyDeactivationReason();
    error DecimalsMismatch(uint8 actual, uint8 supplied);
    error InvalidActivationTtl();
    error ApprovalNotYetValid();
    error ApprovalStale();
    error ImmutableVersionMismatch();
    error VersionNotFound();
    error VersionNotActive();
    error DayNotClosed();
    error BallotAlreadyPublished();
    error BallotNotFound();
    error EmptyMaxEthWei();
    error InvalidPurchaseUntil();

    function assetVersionKey(string memory normalizedTicker, address token, bytes32 robinhoodAssetIdHash)
        external
        view
        returns (bytes32);
    function activateVersion(Activation calldata activation) external returns (bytes32 versionKey);
    function deactivateVersion(bytes32 versionKey, bytes32 reasonHash) external;
    function publishBallot(
        uint256 day,
        bytes32 versionKey,
        bytes32 tallyHash,
        uint256 catalogVersion,
        uint256 maxEthWei,
        uint64 purchaseUntil
    ) external;
    function resolveBallot(uint256 day)
        external
        view
        returns (
            bytes32 versionKey,
            address token,
            uint8 tokenDecimals,
            bytes32 tallyHash,
            uint256 catalogVersion,
            uint256 maxEthWei,
            uint64 purchaseUntil,
            bool active
        );

    function supportedChainId() external view returns (uint256);
    function publisher() external view returns (address);
    function catalogVersion() external view returns (uint256);
    function versionCount() external view returns (uint256);
    function versionKeyAt(uint256 index) external view returns (bytes32);
    function getVersion(bytes32 versionKey) external view returns (AssetVersion memory);
    function activeVersionForTickerHash(bytes32 tickerHash) external view returns (bytes32);
    function activeVersionForToken(address token) external view returns (bytes32);
    function activeVersionForProviderIdHash(bytes32 providerIdHash) external view returns (bytes32);
    function setPublisher(address publisher_) external;
    function getBallot(uint256 day) external view returns (Ballot memory);
}
