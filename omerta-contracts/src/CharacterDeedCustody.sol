// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {StreetDeed} from "./StreetDeed.sol";
import {DeedStockAccount} from "./DeedStockAccount.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IOmertaRestrictedOMRV2} from "./market-v2/IOmertaRestrictedOMRV2.sol";

interface IDeedAccountRegistry {
    function account(address implementation, bytes32 salt, uint256 chainId, address collection, uint256 tokenId)
        external
        view
        returns (address);
    function createAccount(address implementation, bytes32 salt, uint256 chainId, address collection, uint256 tokenId)
        external
        returns (address);
}

interface ILifeAccountRegistry {
    function isLifeAccount(address account) external view returns (bool);
}

interface IDeedVolumeSource {
    function omr() external view returns (address);
    function dailyOmrVolume(uint256 utcDay) external view returns (uint256);
    function volumeTrackingStartDay() external view returns (uint256);
}

/// @notice A restricted escrow for one mortal life, not an owner-executable wallet.
/// @dev Only custody can release our deeds; there is no approval, redeem, or generic execution surface.
contract CharacterDeedAccount is IERC721Receiver {
    address public immutable custody;
    StreetDeed public immutable deed;
    bytes32 public immutable lifeId;

    constructor(address custody_, StreetDeed deed_, bytes32 lifeId_) {
        custody = custody_;
        deed = deed_;
        lifeId = lifeId_;
    }

    function release(uint256 deedId, address to) external {
        require(msg.sender == custody, "CDA: only custody");
        deed.setTransferLock(deedId, false);
        deed.safeTransferFrom(address(this), to, deedId);
    }

    function onERC721Received(address operator, address, uint256, bytes calldata) external view returns (bytes4) {
        require(msg.sender == address(deed), "CDA: wrong collection");
        require(operator == custody || ILifeAccountRegistry(custody).isLifeAccount(operator), "CDA: use equip");
        return IERC721Receiver.onERC721Received.selector;
    }
}

/// @title CharacterDeedCustody
/// @notice Owner-consented equipment, ordered game-oracle death records and bounded successive-killer loot.
/// @dev The lifecycle operator is the trusted game oracle. It must serialize authoritative deaths and
///      fresh safe exits against gameplay, and wait for chain finality before admitting renewed risk.
///      An unreported offchain death cannot invalidate a transaction already sent to the chain.
///      Non-player deaths route to the same bloodline's heir after a fixed 24-hour estate delay.
///      This contract has no rescue/admin transfer path around owner consent or recorded death edges.
contract CharacterDeedCustody is Ownable2Step, EIP712, ReentrancyGuard {
    uint256 public constant MAX_EXIT_TTL = 5 minutes;
    uint256 public constant MAX_SETTLEMENT_HOPS = 32;
    uint256 public constant ESTATE_DELAY = 1 days;
    uint256 public constant MAX_SAFE_HOUSE_DAYS = 7;
    uint256 public constant MIN_SAFE_HOUSE_DAILY_BURN = 1e18;
    uint256 public constant MAX_SAFE_HOUSE_DAILY_BURN = 25e18;
    bytes32 public constant EXIT_TYPEHASH =
        keccak256("ExitRequest(bytes32 lifeId,uint256 deedId,uint256 nonce,uint256 issuedAt,uint256 deadline)");
    bytes32 public constant SAFE_HOUSE_TYPEHASH = keccak256(
        "SafeHouseRequest(bytes32 lifeId,uint256 deedId,uint256 days_,uint256 priceDay,uint256 maxBurn,uint256 nonce,uint256 issuedAt,uint256 deadline)"
    );

    struct Life {
        address account;
        address wallet;
        uint256 dynastyId;
        bool dead;
        bytes32 killer;
        uint256 deathSequence;
        uint256 deathAt;
        bytes32 heir;
        bool estateDeath;
    }

    struct ExitRequest {
        bytes32 lifeId;
        uint256 deedId;
        uint256 nonce;
        uint256 issuedAt;
        uint256 deadline;
    }

    struct SafeHouseRequest {
        bytes32 lifeId;
        uint256 deedId;
        uint256 days_;
        uint256 priceDay;
        uint256 maxBurn;
        uint256 nonce;
        uint256 issuedAt;
        uint256 deadline;
    }

    struct Coverage {
        uint256 startsAt;
        uint256 endsAt;
    }

    struct PurchaseReceipt {
        uint256 priceDay;
        uint256 previousDayVolume;
        uint256 burnAmount;
        uint256 startsAt;
        uint256 until;
    }

    StreetDeed public immutable deed;
    IERC721 public immutable dynasty;
    IDeedAccountRegistry public immutable accountRegistry;
    address public immutable accountImplementation;
    IOmertaRestrictedOMRV2 public immutable omr;
    IDeedVolumeSource public immutable volumeSource;
    bytes32 public immutable volumeSourceRuntimeHash;
    address public lifecycleOperator;
    uint256 public deathSequence;
    uint256 public lastAuthoritativeDeathAt;
    mapping(bytes32 => Life) private _lives;
    mapping(address => bytes32) public lifeOfAccount;
    mapping(uint256 => bytes32) public activeLifeByDynasty;
    mapping(bytes32 => uint256) public exitNonce;
    mapping(bytes32 => uint256) public estateReleaseAt;
    mapping(bytes32 => bytes32) public estateParentOf;
    mapping(bytes32 => bytes32) public estateFamilyOf;
    mapping(bytes32 => uint256) public estateDynastyOf;
    mapping(bytes32 => uint256) public safeHouseNonce;
    mapping(uint256 => mapping(uint256 => Coverage[])) private _coverage;

    event LifecycleOperatorSet(address indexed operator);
    event LifeRegistered(bytes32 indexed lifeId, address indexed account, address indexed wallet, uint256 dynastyId);
    event LifeBound(bytes32 indexed lifeId, address indexed wallet, uint256 indexed dynastyId);
    event DeathRecorded(
        bytes32 indexed victimLifeId,
        bytes32 indexed killerLifeId,
        uint256 indexed deathSequence,
        bytes32 heirLifeId,
        uint256 deathAt
    );
    event EstateDeathRecorded(
        bytes32 indexed victimLifeId, bytes32 indexed heirLifeId, uint256 indexed deathSequence, uint256 releaseAt
    );
    event DeedEquipped(uint256 indexed deedId, bytes32 indexed lifeId, address indexed wallet, address vault);
    event DeedSettled(uint256 indexed deedId, bytes32 indexed fromLifeId, bytes32 indexed toLifeId, uint256 hops);
    event DeedUnequipped(uint256 indexed deedId, bytes32 indexed lifeId, address indexed wallet, uint256 nonce);
    event SafeHousePurchased(
        uint256 indexed deedId,
        bytes32 indexed lifeId,
        uint256 indexed dynastyId,
        uint256 priceDay,
        uint256 previousDayVolume,
        uint256 burnAmount,
        uint256 startsAt,
        uint256 until,
        uint256 nonce
    );

    constructor(
        address owner_,
        address operator_,
        StreetDeed deed_,
        IERC721 dynasty_,
        IDeedAccountRegistry registry_,
        IOmertaRestrictedOMRV2 omr_,
        IDeedVolumeSource volumeSource_
    ) Ownable(owner_) EIP712("OmertaDeedCustody", "1") {
        require(operator_ != address(0), "DC: zero operator");
        require(address(deed_).code.length != 0 && address(dynasty_).code.length != 0, "DC: invalid collection");
        require(address(registry_).code.length != 0, "DC: invalid registry");
        require(address(omr_).code.length != 0, "DC: invalid OMR");
        require(address(volumeSource_).code.length != 0, "DC: invalid volume source");
        require(volumeSource_.omr() == address(omr_), "DC: wrong volume token");
        require(IERC165(address(dynasty_)).supportsInterface(0xb45a3c0e), "DC: identity not soulbound");
        deed = deed_;
        dynasty = dynasty_;
        accountRegistry = registry_;
        accountImplementation = address(new DeedStockAccount(address(this), address(deed_)));
        lifecycleOperator = operator_;
        omr = omr_;
        volumeSource = volumeSource_;
        volumeSourceRuntimeHash = address(volumeSource_).codehash;
        emit LifecycleOperatorSet(operator_);
    }

    modifier onlyOperator() {
        require(msg.sender == lifecycleOperator, "DC: only operator");
        _;
    }

    function setLifecycleOperator(address operator_) external onlyOwner {
        require(operator_ != address(0), "DC: zero operator");
        lifecycleOperator = operator_;
        emit LifecycleOperatorSet(operator_);
    }

    function lifeState(bytes32 lifeId) external view returns (Life memory) {
        return _lives[lifeId];
    }

    function accountOf(bytes32 lifeId) external view returns (address) {
        return _lives[lifeId].account;
    }

    function isLifeAccount(address account) public view returns (bool) {
        return lifeOfAccount[account] != bytes32(0);
    }

    function registerPendingLife(bytes32 lifeId) external onlyOperator nonReentrant returns (address) {
        return _register(lifeId);
    }

    function registerLife(bytes32 lifeId, uint256 dynastyId) external onlyOperator nonReentrant returns (address) {
        address account = _register(lifeId);
        _bind(lifeId, dynastyId);
        return account;
    }

    function bindLife(bytes32 lifeId, uint256 dynastyId) external onlyOperator nonReentrant {
        _bind(lifeId, dynastyId);
    }

    function _register(bytes32 lifeId) private returns (address account) {
        require(lifeId != bytes32(0), "DC: zero life");
        require(_lives[lifeId].account == address(0), "DC: life exists");
        account = address(new CharacterDeedAccount(address(this), deed, lifeId));
        _lives[lifeId].account = account;
        estateFamilyOf[lifeId] = lifeId;
        lifeOfAccount[account] = lifeId;
        emit LifeRegistered(lifeId, account, address(0), 0);
    }

    function _bind(bytes32 lifeId, uint256 dynastyId) private {
        Life storage life = _lives[lifeId];
        require(life.account != address(0), "DC: unknown life");
        require(life.wallet == address(0) && dynastyId != 0, "DC: already bound or zero identity");
        bytes32 family = estateFamilyOf[lifeId];
        uint256 familyDynasty = estateDynastyOf[family];
        require(familyDynasty == 0 || familyDynasty == dynastyId, "DC: estate identity mismatch");
        address wallet = dynasty.ownerOf(dynastyId);
        if (!life.dead) {
            require(activeLifeByDynasty[dynastyId] == bytes32(0), "DC: identity already active");
            activeLifeByDynasty[dynastyId] = lifeId;
        }
        life.wallet = wallet;
        life.dynastyId = dynastyId;
        estateDynastyOf[family] = dynastyId;
        emit LifeBound(lifeId, wallet, dynastyId);
    }

    function deedVault(uint256 deedId) public view returns (address) {
        return accountRegistry.account(accountImplementation, bytes32(0), block.chainid, address(deed), deedId);
    }

    function ensureDeedVault(uint256 deedId) public returns (address vault) {
        vault = accountRegistry.createAccount(accountImplementation, bytes32(0), block.chainid, address(deed), deedId);
        require(vault == deedVault(deedId) && vault.code.length != 0, "DC: invalid vault");
    }

    /// @notice Direct owner consent plus the deed's ordinary unlock and approval are required.
    function equip(bytes32 lifeId, uint256 deedId) external nonReentrant {
        Life storage life = _lives[lifeId];
        require(life.account != address(0) && !life.dead, "DC: life not live");
        require(life.wallet == msg.sender, "DC: not life owner");
        require(deed.ownerOf(deedId) == msg.sender, "DC: not deed owner");
        address vault = ensureDeedVault(deedId);
        deed.safeTransferFrom(msg.sender, life.account, deedId);
        emit DeedEquipped(deedId, lifeId, msg.sender, vault);
    }

    /// @notice Derive equipment from NFT ownership, including unsafe transfers that bypass callbacks.
    function equippedLife(uint256 deedId) public view returns (bytes32) {
        return lifeOfAccount[deed.ownerOf(deedId)];
    }

    function recordDeath(
        bytes32 victimLifeId,
        bytes32 killerLifeId,
        bytes32 heirLifeId,
        uint256 expectedSequence,
        uint256 deathAt
    ) external onlyOperator nonReentrant {
        require(killerLifeId != bytes32(0), "DC: estate requires heir");
        _requireLiveSuccessor(victimLifeId, killerLifeId);
        _requireLiveSuccessor(victimLifeId, heirLifeId);
        require(heirLifeId != killerLifeId, "DC: killer cannot be heir");
        _closeLife(victimLifeId, killerLifeId, heirLifeId, expectedSequence, deathAt, false);
        _prepareHeir(victimLifeId, heirLifeId);
    }

    /// @notice Record a non-player death and its immutable heir, releasing the estate after 24 hours.
    /// @dev The game oracle attests account/generation relationships while identities are unminted.
    ///      A shared family identity anchor enforces the same dynasty whenever any member later binds.
    function recordEstateDeath(bytes32 victimLifeId, bytes32 heirLifeId, uint256 expectedSequence, uint256 deathAt)
        external
        onlyOperator
        nonReentrant
    {
        _requireLiveSuccessor(victimLifeId, heirLifeId);
        _closeLife(victimLifeId, heirLifeId, heirLifeId, expectedSequence, deathAt, true);
        _prepareHeir(victimLifeId, heirLifeId);
        emit EstateDeathRecorded(
            victimLifeId, heirLifeId, _lives[victimLifeId].deathSequence, estateReleaseAt[victimLifeId]
        );
    }

    function _prepareHeir(bytes32 victimLifeId, bytes32 heirLifeId) private {
        require(estateParentOf[heirLifeId] == bytes32(0), "DC: heir already assigned");
        bytes32 family = estateFamilyOf[victimLifeId];
        uint256 familyDynasty = estateDynastyOf[family];
        uint256 heirDynasty = estateDynastyOf[estateFamilyOf[heirLifeId]];
        require(familyDynasty == 0 || heirDynasty == 0 || familyDynasty == heirDynasty, "DC: heir identity mismatch");
        if (familyDynasty == 0) {
            familyDynasty = heirDynasty;
            estateDynastyOf[family] = familyDynasty;
        }
        estateFamilyOf[heirLifeId] = family;
        estateParentOf[heirLifeId] = victimLifeId;
        if (familyDynasty != 0 && _lives[heirLifeId].dynastyId == 0) _bind(heirLifeId, familyDynasty);
    }

    function _requireLiveSuccessor(bytes32 victimLifeId, bytes32 successorLifeId) private view {
        Life storage victim = _lives[victimLifeId];
        require(victim.account != address(0) && !victim.dead, "DC: victim not live");
        Life storage successor = _lives[successorLifeId];
        require(
            successorLifeId != victimLifeId && successor.account != address(0) && !successor.dead, "DC: killer not live"
        );
    }

    function _closeLife(
        bytes32 victimLifeId,
        bytes32 successorLifeId,
        bytes32 heirLifeId,
        uint256 expectedSequence,
        uint256 deathAt,
        bool estateDeath
    ) private {
        require(expectedSequence == deathSequence + 1, "DC: death sequence");
        require(deathAt != 0 && deathAt <= block.timestamp && deathAt >= lastAuthoritativeDeathAt, "DC: death time");
        Life storage victim = _lives[victimLifeId];
        victim.dead = true;
        victim.killer = successorLifeId;
        victim.deathSequence = ++deathSequence;
        victim.deathAt = deathAt;
        victim.heir = heirLifeId;
        victim.estateDeath = estateDeath;
        lastAuthoritativeDeathAt = deathAt;
        estateReleaseAt[victimLifeId] = deathAt + ESTATE_DELAY;
        if (victim.dynastyId != 0) delete activeLifeByDynasty[victim.dynastyId];
        ++exitNonce[victimLifeId];
        ++safeHouseNonce[victimLifeId];
        emit DeathRecorded(victimLifeId, successorLifeId, victim.deathSequence, heirLifeId, deathAt);
    }

    /// @notice Permissionless bounded progress; a later call can continue from a dead intermediate life.
    function settleDeed(uint256 deedId, uint256 maxHops) external nonReentrant returns (bytes32 targetLifeId) {
        require(maxHops != 0 && maxHops <= MAX_SETTLEMENT_HOPS, "DC: invalid hops");
        bytes32 sourceLifeId = equippedLife(deedId);
        require(sourceLifeId != bytes32(0), "DC: not equipped");
        targetLifeId = sourceLifeId;
        uint256 hops;
        while (hops < maxHops) {
            Life storage current = _lives[targetLifeId];
            if (!current.dead || current.killer == bytes32(0)) break;
            bool protectedEstate = current.estateDeath || safeHouseCoveredAt(deedId, current.dynastyId, current.deathAt);
            if (protectedEstate && block.timestamp < estateReleaseAt[targetLifeId]) break;
            bytes32 successor = protectedEstate ? current.heir : current.killer;
            Life storage next = _lives[successor];
            require(next.account != address(0), "DC: missing successor");
            require(!next.dead || next.deathSequence > current.deathSequence, "DC: invalid chronology");
            targetLifeId = successor;
            ++hops;
        }
        require(hops != 0, "DC: no settlement");
        CharacterDeedAccount(_lives[sourceLifeId].account).release(deedId, _lives[targetLifeId].account);
        emit DeedSettled(deedId, sourceLifeId, targetLifeId, hops);
    }

    function hashExit(ExitRequest calldata request) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    EXIT_TYPEHASH, request.lifeId, request.deedId, request.nonce, request.issuedAt, request.deadline
                )
            )
        );
    }

    /// @notice Today's fixed daily price uses yesterday's completed raw OMR turnover, in OMR units.
    /// @dev 100,000 OMR traded => 5 OMR/day; floor 1 OMR, ceiling 25 OMR. No price setter/oracle exists.
    function safeHouseQuote() public view returns (uint256 priceDay, uint256 previousDayVolume, uint256 dailyBurn) {
        require(omr.policySealed() && omr.settlementManager() == address(volumeSource), "DC: volume source not bound");
        require(address(volumeSource).codehash == volumeSourceRuntimeHash, "DC: volume runtime changed");
        priceDay = block.timestamp / 1 days;
        require(priceDay > volumeSource.volumeTrackingStartDay(), "DC: full volume day unavailable");
        previousDayVolume = volumeSource.dailyOmrVolume(priceDay - 1);
        dailyBurn = previousDayVolume / 20_000;
        if (dailyBurn < MIN_SAFE_HOUSE_DAILY_BURN) dailyBurn = MIN_SAFE_HOUSE_DAILY_BURN;
        if (dailyBurn > MAX_SAFE_HOUSE_DAILY_BURN) dailyBurn = MAX_SAFE_HOUSE_DAILY_BURN;
    }

    function safeHouseUntil(uint256 deedId, uint256 dynastyId) external view returns (uint256) {
        Coverage[] storage windows = _coverage[deedId][dynastyId];
        return windows.length == 0 ? 0 : windows[windows.length - 1].endsAt;
    }

    /// @notice Retained interval history prevents later renewal from rewriting coverage at an earlier death.
    function safeHouseCoveredAt(uint256 deedId, uint256 dynastyId, uint256 timestamp) public view returns (bool) {
        if (dynastyId == 0) return false;
        Coverage[] storage windows = _coverage[deedId][dynastyId];
        uint256 low;
        uint256 high = windows.length;
        while (low < high) {
            uint256 middle = low + (high - low) / 2;
            if (windows[middle].startsAt <= timestamp) low = middle + 1;
            else high = middle;
        }
        return low != 0 && timestamp < windows[low - 1].endsAt;
    }

    function hashSafeHouse(SafeHouseRequest calldata request) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    SAFE_HOUSE_TYPEHASH,
                    request.lifeId,
                    request.deedId,
                    request.days_,
                    request.priceDay,
                    request.maxBurn,
                    request.nonce,
                    request.issuedAt,
                    request.deadline
                )
            )
        );
    }

    /// @notice The operator serializes a fresh owner-signed purchase against authoritative gameplay deaths.
    /// @dev Burns the wallet's approved OMR; coverage locks in today's price for full 24-hour periods.
    ///      New windows begin next second to exclude same-second purchases after an undisclosed death.
    ///      Already-active coverage can renew without a gap. No refund, cancel or withdrawal path exists.
    function prepaySafeHouse(SafeHouseRequest calldata request, bytes calldata ownerSignature)
        external
        onlyOperator
        nonReentrant
    {
        Life storage life = _lives[request.lifeId];
        require(life.account != address(0) && !life.dead && life.wallet != address(0), "DC: life not live");
        require(equippedLife(request.deedId) == request.lifeId, "DC: wrong life");
        require(request.days_ != 0 && request.days_ <= MAX_SAFE_HOUSE_DAYS, "DC: invalid days");
        require(request.nonce == safeHouseNonce[request.lifeId], "DC: safe house nonce");
        require(
            request.issuedAt <= block.timestamp && block.timestamp <= request.deadline, "DC: payment expired or early"
        );
        require(
            request.deadline >= request.issuedAt && request.deadline - request.issuedAt <= MAX_EXIT_TTL,
            "DC: payment TTL"
        );
        require(
            SignatureChecker.isValidSignatureNowCalldata(life.wallet, hashSafeHouse(request), ownerSignature),
            "DC: owner signature"
        );
        PurchaseReceipt memory receipt;
        uint256 dailyBurn;
        (receipt.priceDay, receipt.previousDayVolume, dailyBurn) = safeHouseQuote();
        require(request.priceDay == receipt.priceDay, "DC: price day changed");
        receipt.burnAmount = dailyBurn * request.days_;
        require(receipt.burnAmount <= request.maxBurn, "DC: burn exceeds consent");
        (receipt.startsAt, receipt.until) = _extendCoverage(request.deedId, life.dynastyId, request.days_);
        ++safeHouseNonce[request.lifeId];
        omr.burnFrom(life.wallet, receipt.burnAmount);
        _emitPurchase(request, life.dynastyId, receipt);
    }

    function _emitPurchase(SafeHouseRequest calldata request, uint256 dynastyId, PurchaseReceipt memory receipt) private {
        emit SafeHousePurchased(
            request.deedId,
            request.lifeId,
            dynastyId,
            receipt.priceDay,
            receipt.previousDayVolume,
            receipt.burnAmount,
            receipt.startsAt,
            receipt.until,
            request.nonce
        );
    }

    function _extendCoverage(uint256 deedId, uint256 dynastyId, uint256 days_)
        private
        returns (uint256 start, uint256 until)
    {
        Coverage[] storage windows = _coverage[deedId][dynastyId];
        start = block.timestamp + 1;
        if (windows.length != 0 && windows[windows.length - 1].endsAt >= start) {
            Coverage storage current = windows[windows.length - 1];
            start = current.startsAt;
            until = current.endsAt + days_ * 1 days;
            current.endsAt = until;
        } else {
            until = start + days_ * 1 days;
            windows.push(Coverage(start, until));
        }
        require(until <= block.timestamp + 1 + MAX_SAFE_HOUSE_DAYS * 1 days, "DC: prepaid horizon");
    }

    /// @notice Only the server operator can finalize a freshly checked safe exit with the owner's intent.
    /// @dev No server certificate usable directly by a player exists. The operator's serialized offchain
    ///      safe-state/finality gate is required; this function sees only recorded onchain lifecycle state.
    function unequip(ExitRequest calldata request, bytes calldata ownerSignature) external onlyOperator nonReentrant {
        Life storage life = _lives[request.lifeId];
        require(life.account != address(0) && !life.dead && life.wallet != address(0), "DC: life not live");
        require(equippedLife(request.deedId) == request.lifeId, "DC: wrong life");
        require(request.nonce == exitNonce[request.lifeId], "DC: exit nonce");
        require(request.issuedAt <= block.timestamp && block.timestamp <= request.deadline, "DC: exit expired or early");
        require(
            request.deadline >= request.issuedAt && request.deadline - request.issuedAt <= MAX_EXIT_TTL, "DC: exit TTL"
        );
        require(
            SignatureChecker.isValidSignatureNowCalldata(life.wallet, hashExit(request), ownerSignature),
            "DC: owner signature"
        );
        ++exitNonce[request.lifeId];
        CharacterDeedAccount(life.account).release(request.deedId, life.wallet);
        emit DeedUnequipped(request.deedId, request.lifeId, life.wallet, request.nonce);
    }
}
