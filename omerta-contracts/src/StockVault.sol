// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title StockVault — the delivery contract for OMERTÀ's Stock Token reward (brokers step 7,
///        omerta-brokers-design.md §3.3 / §5.1; omerta-dynasty-machine-design.md §3/§8).
/// @notice Holds Stock Token ERC-20s the treasury keeper PRE-BOUGHT and PUSHES the
///         allocated units straight into a player's ERC-6551 token-bound account.
///
///         WHICH token-bound account is a backend decision this contract deliberately knows nothing
///         about (`deliver` takes a plain address), and the shipped answer is the STREET DEED's —
///         own the street, and the street holds your legit book. NOT the identity NFT: keeping stock
///         off `DynastyNFT` is what preserves its entitlement wall (see that contract's header).
///
///         AUTOMATIC PUSH, WITH SERVER-AUTHORITY ATTESTATION: there is no player claim process. The EVM
///         cannot query OMERTÀ's gameplay DB, so the server computes the frozen active-play allocation.
///         When the Safe sets `allocationSigner`, every push must carry that independent signer's EIP-712
///         authorization binding the exact epoch/account hashes, token, destination, units, id and deadline;
///         the legacy keeper-only entry points are disabled. Zero signer is retained only as an explicit
///         Safe-controlled migration/dev posture. This attestation proves what the authoritative server
///         approved. Per the founder's permissionless-delivery posture, neither this contract nor the
///         game performs recipient KYC/compliance screening; launch legality remains an off-chain review.
///
///         IT MINTS NOTHING. Every delivery is a plain SafeERC20 transfer of a PRE-HELD balance — the same
///         "the bridge never mints" invariant as VoucherClaim. `held` is `balanceOf(this)` per token, so a
///         delivery physically CANNOT exceed what the vault holds (the ERC-20 reverts). That is the on-chain
///         half of the design's `allocated ≤ held (per ticker, in units)` wall; the OTHER half — the
///         allocation LEDGER and its clamping writer (`allocateStock`) plus the nightly `runTreasuryInvariants`
///         — lives in the backend, because a per-account owed-side ledger is not a thing a stateless
///         distributor should hold. The clamp is the prevention; this contract is the last physical bound.
///
///         A leaked KEEPER key is bounded by: the per-token daily delivery cap (rate), the Safe pausing
///         deliveries, the Safe rotating the keeper (`setKeeper`), and — decisively — that the keeper can
///         only ever move stock the vault ALREADY HOLDS, which the Safe can pull back at any time (`sweep`).
///         No mint path, so a compromised keeper cannot conjure units, only move held ones to a wrong
///         address, which the Safe stops by pausing + rotating and recovers to the extent units remain.
contract StockVault is Ownable2Step, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    struct DeliveryAuthorization {
        uint256 deliveryId;
        bytes32 epochHash;
        bytes32 accountHash;
        address token;
        address to;
        uint256 units;
        uint256 deadline;
    }

    bytes32 public constant DELIVERY_AUTHORIZATION_TYPEHASH = keccak256(
        "DeliveryAuthorization(uint256 deliveryId,bytes32 epochHash,bytes32 accountHash,address token,address to,uint256 units,uint256 deadline)"
    );

    /// @notice The automated delivery bot (the treasury's push keeper). Safe-set; 0 = deliveries disabled.
    address public keeper;

    /// @notice The isolated server key that attests a delivery came from a frozen, qualified gameplay
    ///         allocation. Zero preserves the legacy keeper-only mode; nonzero makes authorization
    ///         mandatory and disables `deliver`/`deliverBatch` entirely.
    address public allocationSigner;

    /// @notice Per-token daily delivery cap in units (0 = unlimited) — a leaked-keeper rate wall, the
    ///         VoucherClaim.dailyCapOMR discipline applied per stock so one key can't drain a whole ticker
    ///         in a block. The Safe sets it per token.
    mapping(address => uint256) public dailyCap; // token => max units/UTC day (0 = unlimited)
    mapping(address => bool) public capConfigured; // token => the Safe has SET a cap (even 0)
    mapping(address => mapping(uint256 => uint256)) public deliveredOnDay; // token => day => units delivered

    /// @notice The wall a token inherits when the Safe has never set one (0 = unlimited).
    ///
    ///         Sibling contracts read `0 = unlimited` off a single constructor argument, so forgetting
    ///         it is one visible mistake at deploy. This cap is a MAPPING and the set of tickers GROWS:
    ///         the Commission votes a ticker daily from a list the operator extends by adding a token
    ///         address, and nothing in that process forces a `setDailyCap` for the new one. So the
    ///         default had to be safe rather than infinite — otherwise a freshly-added ticker is the
    ///         one stock a leaked keeper key can drain in a single block, silently, while every
    ///         configured ticker holds (red-team C2). An EXPLICIT `setDailyCap(token, 0)` still means
    ///         unlimited: the convention survives, only the never-set case changes.
    uint256 public defaultDailyCap;

    /// @notice Idempotency: the backend stamps each allocation a unique deliveryId; a re-driven delivery
    ///         (retry, reorg re-scan) is a clean no-op, so a delivery lands AT MOST once.
    mapping(uint256 => bool) public usedDeliveryId;

    event KeeperSet(address indexed keeper);
    event AllocationSignerSet(address indexed signer);
    event AllocationAuthorized(uint256 indexed deliveryId, bytes32 indexed epochHash, bytes32 indexed accountHash);
    event DailyCapSet(address indexed token, uint256 cap);
    event DefaultDailyCapSet(uint256 cap);
    event Delivered(uint256 indexed deliveryId, address indexed token, address indexed to, uint256 units);
    event Swept(address indexed token, address indexed to, uint256 amount);

    modifier onlyKeeper() {
        require(msg.sender == keeper && keeper != address(0), "SV: not keeper");
        _;
    }

    constructor(address owner_, address keeper_, uint256 defaultDailyCap_)
        Ownable(owner_)
        EIP712("OMERTA StockVault", "1")
    {
        keeper = keeper_; // may be 0 at deploy (deliveries off until the Safe wires the bot)
        defaultDailyCap = defaultDailyCap_;
        emit KeeperSet(keeper_);
        emit DefaultDailyCapSet(defaultDailyCap_);
    }

    // ── admin (the Safe) ──
    function setKeeper(address k) external onlyOwner {
        keeper = k;
        emit KeeperSet(k);
    }

    /// @notice Enable/rotate the activity-allocation attestor. Setting zero is an explicit Safe
    ///         rollback to the legacy keeper-only rail; production should arm this before the keeper.
    function setAllocationSigner(address signer_) external onlyOwner {
        allocationSigner = signer_;
        emit AllocationSignerSet(signer_);
    }

    function setDailyCap(address token, uint256 cap) external onlyOwner {
        require(token != address(0), "SV: zero token");
        dailyCap[token] = cap;
        capConfigured[token] = true; // an EXPLICIT 0 means unlimited; never-set falls back below
        emit DailyCapSet(token, cap);
    }

    function setDefaultDailyCap(uint256 cap) external onlyOwner {
        defaultDailyCap = cap;
        emit DefaultDailyCapSet(cap);
    }

    /// @notice The wall actually applied to `token` — its own cap once the Safe has set one, else the
    ///         default. Public so an operator can see at a glance which tickers are on the fallback.
    function effectiveDailyCap(address token) public view returns (uint256) {
        return capConfigured[token] ? dailyCap[token] : defaultDailyCap;
    }

    // Pausing stops NEW deliveries. It can never trap a player's stock — delivered stock already sits in the
    // player's token-bound account, and undelivered stock is the Safe's to `sweep`.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Tranche management: the Safe pulls unspent stock back (the VoucherClaim.sweep precedent).
    ///         Routes to a Safe-chosen `to`, never a fixed recipient, so a misconfig can't trap the pull.
    function sweep(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "SV: zero recipient");
        IERC20(token).safeTransfer(to, amount);
        emit Swept(token, to, amount);
    }

    // ── the push (keeper-driven, gateless) ──
    /// @notice Deliver `units` of `token` into `to` (the player's ERC-6551 token-bound account, computed by
    ///         the backend and resolved at delivery time). Pre-held transfer only — NEVER mints. Idempotent
    ///         on `deliveryId`.
    function deliver(uint256 deliveryId, address token, address to, uint256 units)
        external
        onlyKeeper
        nonReentrant
        whenNotPaused
    {
        require(allocationSigner == address(0), "SV: authorization required");
        _deliver(deliveryId, token, to, units);
    }

    /// @notice Deliver only after the independent allocation signer attests that this exact transfer
    ///         descends from the server-authoritative active-play snapshot. The hashes keep private DB
    ///         identifiers off-chain while binding the signature to one account and epoch for audit.
    function deliverAuthorized(DeliveryAuthorization calldata auth, bytes calldata signature)
        external
        onlyKeeper
        nonReentrant
        whenNotPaused
    {
        require(allocationSigner != address(0), "SV: authorization disabled");
        require(auth.deadline >= block.timestamp, "SV: authorization expired");
        require(auth.epochHash != bytes32(0) && auth.accountHash != bytes32(0), "SV: empty allocation identity");
        require(ECDSA.recover(hashAuthorization(auth), signature) == allocationSigner, "SV: bad authorization");
        emit AllocationAuthorized(auth.deliveryId, auth.epochHash, auth.accountHash);
        _deliver(auth.deliveryId, auth.token, auth.to, auth.units);
    }

    function hashAuthorization(DeliveryAuthorization calldata auth) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    DELIVERY_AUTHORIZATION_TYPEHASH,
                    auth.deliveryId,
                    auth.epochHash,
                    auth.accountHash,
                    auth.token,
                    auth.to,
                    auth.units,
                    auth.deadline
                )
            )
        );
    }

    /// @notice Batch the push for gas — the distributor delivers to many accounts per run. Same per-item
    ///         idempotency + daily cap + pre-held bound; any one item reverting reverts the batch (the
    ///         backend re-drives the survivors on the next tick, their deliveryIds still unused).
    function deliverBatch(
        uint256[] calldata deliveryIds,
        address[] calldata tokens,
        address[] calldata tos,
        uint256[] calldata unitsArr
    ) external onlyKeeper nonReentrant whenNotPaused {
        require(allocationSigner == address(0), "SV: authorization required");
        uint256 n = deliveryIds.length;
        require(tokens.length == n && tos.length == n && unitsArr.length == n, "SV: length mismatch");
        for (uint256 i = 0; i < n; i++) {
            _deliver(deliveryIds[i], tokens[i], tos[i], unitsArr[i]);
        }
    }

    function _deliver(uint256 deliveryId, address token, address to, uint256 units) private {
        require(to != address(0), "SV: zero recipient");
        require(token != address(0), "SV: zero token");
        require(units != 0, "SV: zero units");
        require(!usedDeliveryId[deliveryId], "SV: replay");
        usedDeliveryId[deliveryId] = true;

        uint256 cap = effectiveDailyCap(token);
        if (cap != 0) {
            uint256 day = block.timestamp / 1 days;
            uint256 newTotal = deliveredOnDay[token][day] + units;
            require(newTotal <= cap, "SV: daily cap");
            deliveredOnDay[token][day] = newTotal;
        }

        IERC20(token).safeTransfer(to, units); // transfers a pre-held balance; reverts if > held; NEVER mints
        emit Delivered(deliveryId, token, to, units);
    }
}
