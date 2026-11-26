// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {IFeeRevenueRouter} from "./FeeRevenueRouter.sol";

/// @title StreetDeed — the on-chain half of OMERTÀ's Street Deeds (omerta-street-deeds-design.md §2/§3).
/// @notice A named, mapped plot of the city, extracted from the game as a tradeable ERC-721 collectible.
///
///         THE ONE STRUCTURAL RULE (design §0): the DEED transfers on-chain, the game's EXTRACTION
///         ENTITLEMENT and the rent/turf CONTROL do NOT. Provenance (the legend) travels with the
///         token — it is the value — and it is served off-chain because it is LIVE game history that
///         grows. Control is earned in-game; buying this token buys a collectible with a history, never
///         game power, so a liquid secondary market is safe (the v3-step-7 rarity-NFT posture: an
///         extracted item is INERT in-game). To play the rent/turf game with a deed again, its holder
///         RE-IMPORTS it (`redeem` → the burn is the proof; the backend re-creates the in-game deed).
///
///         Public issuance is split into 1,000 paid and 1,000 gameplay-earned identities. Gameplay
///         vouchers use a separate signed type and never charge a primary-sale payment.
///         A separate, fixed 500-identity partnership allocation may be minted by the Safe only to
///         its one-time configured recipient. A compromised signer is bounded by the daily cap, nonce
///         (no replay), the short deadline (+ a MAX_VOUCHER_TTL backstop), the Safe rotating the
///         signer — and, decisively, that a deed carries NO extraction value (the `minted` flag does
///         not travel), so a signer that mints trophies to itself steals nothing a player can cash out.
///
///         tokenId = uint256(keccak256(bytes(name))). The server signs the canonical street NAME and
///         the contract DERIVES the tokenId, so the name↔tokenId map is a bijection enforced on-chain:
///         a voucher can never claim one tokenId for a different name, and a name can be minted at most
///         once (ERC-721 `_safeMint` reverts on an existing token). After a `redeem` burns it the token
///         no longer exists, so a fresh voucher (new nonce) can re-extract the SAME street — the id is
///         stable across round-trips because the name never changes.
contract StreetDeed is ERC721, EIP712, Ownable2Step, Pausable, ReentrancyGuard {
    using Strings for uint256;

    /// @notice Deadline backstop, mirroring VoucherClaim.MAX_VOUCHER_TTL — a leaked-then-rotated
    ///         signer key's pre-signed vouchers can't stay claimable for months. The server signs
    ///         much shorter deadlines in practice.
    uint256 public constant MAX_VOUCHER_TTL = 30 days;

    /// @notice Permanent cap on distinct streets, including identities whose NFT was redeemed.
    ///         Re-extracting the same street does not issue another identity or free a supply slot.
    uint256 public constant MAX_DEED_IDENTITIES = 2_500;
    uint256 public constant MAX_PUBLIC_IDENTITIES = 2_000;
    uint256 public constant MAX_PAID_IDENTITIES = 1_000;
    uint256 public constant MAX_GAMEPLAY_IDENTITIES = 1_000;
    uint256 public constant MAX_PARTNERSHIP_IDENTITIES = 500;
    uint256 public constant MAX_PARTNERSHIP_BATCH = 25;
    uint256 public constant PUBLIC_PRICE_STEP = 0.01 ether;
    uint256 public constant PUBLIC_PRICE_TIER_SIZE = 100;
    uint256 public totalDeedIdentities;
    uint256 public paidPublicCount;
    uint256 public gameplayMintedCount;
    uint256 public partnershipMintedCount;
    bool public primarySaleConfigured;
    address public partnershipRecipient;
    address payable public saleProceedsRecipient;
    bool public saleProceedsRouted;

    struct DeedIdentity {
        string name;
        string district;
    }

    error PrimarySaleNotConfigured();
    error PrimarySaleAlreadyConfigured();
    error InvalidPrimarySaleConfiguration();
    error PublicSaleSoldOut();
    error GameplaySupplyExceeded();
    error IncorrectPublicPayment(uint256 supplied, uint256 required);
    error PartnershipSupplyExceeded();
    error InvalidPartnershipBatch();
    error IdentityAlreadyIssued();
    error SalePaymentFailed();

    event PrimarySaleConfigured(address indexed partnershipRecipient, address indexed proceedsRecipient, bool routeProceeds);
    event PublicSalePaid(address indexed payer, address indexed to, uint256 indexed tokenId, uint256 publicCount, uint256 amount);
    event GameplayIdentityIssued(address indexed to, uint256 indexed tokenId, uint256 gameplayCount);
    event PartnershipMinted(address indexed to, uint256 indexed tokenId, string name, string district);

    bytes32 public constant DEED_VOUCHER_TYPEHASH =
        keccak256("DeedVoucher(address to,string name,string district,uint256 nonce,uint256 deadline)");

    bytes32 public constant GAMEPLAY_DEED_VOUCHER_TYPEHASH =
        keccak256("GameplayDeedVoucher(address to,string name,string district,uint256 nonce,uint256 deadline)");

    struct DeedVoucher {
        address to;
        string name; // the canonical street name; tokenId = uint256(keccak256(bytes(name)))
        string district; // the mapped district (display string) — on-chain identity, immutable
        uint256 nonce; // server-unique; replay protection
        uint256 deadline; // unix seconds
    }

    address public signer;
    uint256 public dailyMintCap; // max deeds mintable per UTC day, 0 = unlimited (a leaked-signer rate wall)
    mapping(uint256 => bool) public usedNonce;
    mapping(uint256 => uint256) public mintedOnDay; // day => deeds minted

    // ── on-chain identity (immutable per token; survives the game server being down) ──
    mapping(uint256 => string) public deedName;
    /// @notice Original issuance route; burning, trading and re-extraction never change it.
    mapping(uint256 => bool) public gameplayIdentity;
    /// @notice THE LISTING LOCK (design 5, drain-before-sale) — every deed is NON-TRANSFERABLE by
    ///         default: minted locked, and RE-LOCKED on every transfer, so each new owner starts
    ///         locked too. Selling is a deliberate two-step — the OWNER (never an approved operator:
    ///         a marketplace approval must not be able to unlock, that is the drain vector) calls
    ///         setTransferLock(id, false), which emits a public event a buyer can anchor on: check
    ///         the deed's ERC-6551 vault CONTENTS after the unlock block — anything drained between
    ///         unlock and sale is visible on-chain in that window. Not an escrow and not airtight
    ///         (an unlocked deed can still be drained pre-sale — the event makes it VISIBLE, which
    ///         is the design's stated preference over a custody scheme); redeem() is NEVER blocked
    ///         by the lock — a lock that trapped the holder's own burn-back would violate the
    ///         never-trap rule the pause already honors.
    mapping(uint256 => bool) public transferLocked;
    mapping(uint256 => string) public deedDistrict;

    // Off-chain pointers for the rich, LIVE parts (the block plate + the legend page). Set by the Safe.
    // The identity (name/district) is on-chain; only the image and the "see its full history" link are
    // off-chain, which is correct: the legend GROWS with play and cannot be immutable.
    string private _imageBase; // e.g. "https://www.omerta.fun/v1/deeds/plate/" → <base><id>.svg
    string private _externalBase; // e.g. "https://www.omerta.fun/deed/"            → <base><id>

    event SignerSet(address indexed signer);
    event DailyMintCapSet(uint256 cap);
    event ImageBaseSet(string base);
    event ExternalBaseSet(string base);
    event TransferLockSet(uint256 indexed tokenId, bool locked, address indexed by);
    event Extracted(uint256 indexed nonce, address indexed to, uint256 indexed tokenId, string name, string district);
    event Redeemed(address indexed from, uint256 indexed tokenId);

    /// @dev `dailyMintCap_` is a CONSTRUCTOR argument rather than a setter-only field on purpose: this
    ///      contract self-mints on the SAME signer key as VoucherClaim/OmertaBond/DynastyNFT, so that key's
    ///      blast radius is the SUM of the four daily caps — and a wall that lives only in a deploy
    ///      checklist is one a deploy can forget. Both siblings that take theirs at construction cannot be
    ///      forgotten; these two could, and were. 0 still means unlimited (the suite-wide convention), so
    ///      this forces a DECISION at deploy, not a particular number.
    constructor(
        address owner_,
        address signer_,
        string memory imageBase_,
        string memory externalBase_,
        uint256 dailyMintCap_
    ) ERC721("OMERTA Street Deed", "STREET") EIP712("OmertaStreetDeed", "1") Ownable(owner_) {
        require(signer_ != address(0), "SD: zero signer");
        signer = signer_;
        _imageBase = imageBase_;
        _externalBase = externalBase_;
        dailyMintCap = dailyMintCap_;
        emit DailyMintCapSet(dailyMintCap_);
    }

    /// @notice Fix the partnership destination and primary-sale payment route before any identity issues.
    /// @dev Routed proceeds use a dedicated fixed-policy router whose feeContract is this collection.
    function configurePrimarySale(address partnershipRecipient_, address payable proceedsRecipient_, bool routeProceeds_)
        external
        onlyOwner
    {
        if (primarySaleConfigured || totalDeedIdentities != 0) revert PrimarySaleAlreadyConfigured();
        if (partnershipRecipient_ == address(0) || partnershipRecipient_ == address(this)
            || proceedsRecipient_ == address(0) || proceedsRecipient_ == address(this)) {
            revert InvalidPrimarySaleConfiguration();
        }
        if (routeProceeds_) {
            if (proceedsRecipient_.code.length == 0) revert InvalidPrimarySaleConfiguration();
            IFeeRevenueRouter router = IFeeRevenueRouter(proceedsRecipient_);
            if (router.feeContract() != address(this)
                || router.policyId() != keccak256("OMERTA_NON_MINT_FEE_ROUTER_V1_5000_2500_1000_1500")
                || router.devBps() != 5000 || router.vigBps() != 2500
                || router.treasuryBps() != 1000 || router.communityBps() != 1500
                || router.devRecipient() == address(0) || router.vigRecipient() == address(0)
                || router.treasuryRecipient() == address(0) || router.communityRecipient() == address(0)) {
                revert InvalidPrimarySaleConfiguration();
            }
        }
        partnershipRecipient = partnershipRecipient_;
        saleProceedsRecipient = proceedsRecipient_;
        saleProceedsRouted = routeProceeds_;
        primarySaleConfigured = true;
        emit PrimarySaleConfigured(partnershipRecipient_, proceedsRecipient_, routeProceeds_);
    }

    function publicMintPrice() public view returns (uint256) {
        if (!primarySaleConfigured) revert PrimarySaleNotConfigured();
        if (paidPublicCount >= MAX_PAID_IDENTITIES) revert PublicSaleSoldOut();
        return PUBLIC_PRICE_STEP * (paidPublicCount / PUBLIC_PRICE_TIER_SIZE + 1);
    }

    /// @notice Re-extracting any previously issued identity is free and does not advance the price tier.
    function quoteClaim(string calldata name) external view returns (uint256) {
        if (!primarySaleConfigured) revert PrimarySaleNotConfigured();
        if (bytes(deedName[tokenIdFor(name)]).length != 0) return 0;
        return publicMintPrice();
    }

    /// @notice Mint only new partnership identities to the fixed recipient, in atomic batches of at most 25.
    function mintPartnership(DeedIdentity[] calldata identities) external onlyOwner nonReentrant whenNotPaused {
        if (!primarySaleConfigured) revert PrimarySaleNotConfigured();
        uint256 count = identities.length;
        if (count == 0 || count > MAX_PARTNERSHIP_BATCH) revert InvalidPartnershipBatch();
        if (partnershipMintedCount + count > MAX_PARTNERSHIP_IDENTITIES) revert PartnershipSupplyExceeded();
        require(totalDeedIdentities + count <= MAX_DEED_IDENTITIES, "SD: lifetime cap");
        _consumeDailyMints(count);
        for (uint256 i; i < count; ++i) {
            DeedIdentity calldata identity = identities[i];
            require(bytes(identity.name).length != 0, "SD: empty name");
            uint256 id = tokenIdFor(identity.name);
            if (bytes(deedName[id]).length != 0) revert IdentityAlreadyIssued();
            ++partnershipMintedCount;
            ++totalDeedIdentities;
            deedName[id] = identity.name;
            deedDistrict[id] = identity.district;
            _safeMint(partnershipRecipient, id);
            emit PartnershipMinted(partnershipRecipient, id, identity.name, identity.district);
        }
    }

    // ── admin (the Safe) ──
    function setSigner(address s) external onlyOwner {
        require(s != address(0), "SD: zero signer");
        signer = s;
        emit SignerSet(s);
    }

    function setDailyMintCap(uint256 cap) external onlyOwner {
        dailyMintCap = cap;
        emit DailyMintCapSet(cap);
    }

    function setImageBase(string calldata base_) external onlyOwner {
        _imageBase = base_;
        emit ImageBaseSet(base_);
    }

    function setExternalBase(string calldata base_) external onlyOwner {
        _externalBase = base_;
        emit ExternalBaseSet(base_);
    }

    // Pausing stops new EXTRACTIONS (claims) only; `redeem` is never pausable so a holder can always
    // bring their property back into the game — a pause that traps property is a rug the design forbids.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ── the extraction (claim) ──
    function tokenIdFor(string memory name) public pure returns (uint256) {
        return uint256(keccak256(bytes(name)));
    }

    function hashVoucher(DeedVoucher calldata v) public view returns (bytes32) {
        return _hashVoucher(v, DEED_VOUCHER_TYPEHASH);
    }

    function hashGameplayVoucher(DeedVoucher calldata v) public view returns (bytes32) {
        return _hashVoucher(v, GAMEPLAY_DEED_VOUCHER_TYPEHASH);
    }

    function _hashVoucher(DeedVoucher calldata v, bytes32 typehash) private view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    typehash,
                    v.to,
                    keccak256(bytes(v.name)),
                    keccak256(bytes(v.district)),
                    v.nonce,
                    v.deadline
                )
            )
        );
    }

    /// @notice Mint (extract) the deed named `v.name` to `v.to`, on a server signature. tokenId is
    ///         derived from the name, so only one live deed exists per name. After a burn, a fresh
    ///         voucher may re-extract the same immutable identity. The extraction entitlement
    ///         (`minted`) and the rent/turf control stay in the game — this only issues the collectible.
    function claim(DeedVoucher calldata v, bytes calldata sig) external payable nonReentrant whenNotPaused {
        _claim(v, sig, false);
    }

    /// @notice Issue an earned deed without a mint fee, authorized by a gameplay-specific signature.
    /// @dev The game signer verifies discovery eligibility. The contract independently bounds the
    ///      lifetime gameplay allocation, payment, replay domain and aggregate daily mint rate.
    function claimGameplay(DeedVoucher calldata v, bytes calldata sig) external payable nonReentrant whenNotPaused {
        _claim(v, sig, true);
    }

    function _claim(DeedVoucher calldata v, bytes calldata sig, bool gameplay) private {
        require(block.timestamp <= v.deadline, "SD: expired");
        require(v.deadline <= block.timestamp + MAX_VOUCHER_TTL, "SD: deadline too far");
        require(v.to != address(0), "SD: zero recipient");
        require(bytes(v.name).length != 0, "SD: empty name");
        require(!usedNonce[v.nonce], "SD: replay");
        require(ECDSA.recover(gameplay ? hashGameplayVoucher(v) : hashVoucher(v), sig) == signer, "SD: bad signature");
        usedNonce[v.nonce] = true;
        if (!primarySaleConfigured) revert PrimarySaleNotConfigured();
        _consumeDailyMints(1);

        uint256 id = tokenIdFor(v.name);
        uint256 price;
        bool issuedGameplay;
        if (bytes(deedName[id]).length == 0) {
            if (gameplay) {
                if (gameplayMintedCount >= MAX_GAMEPLAY_IDENTITIES) revert GameplaySupplyExceeded();
                ++gameplayMintedCount;
                gameplayIdentity[id] = true;
                issuedGameplay = true;
            } else {
                price = publicMintPrice();
                ++paidPublicCount;
            }
            if (msg.value != price) revert IncorrectPublicPayment(msg.value, price);
            require(totalDeedIdentities < MAX_DEED_IDENTITIES, "SD: lifetime cap");
            ++totalDeedIdentities;
            deedName[id] = v.name;
            deedDistrict[id] = v.district;
        } else {
            require(keccak256(bytes(deedDistrict[id])) == keccak256(bytes(v.district)), "SD: identity changed");
            if (msg.value != 0) revert IncorrectPublicPayment(msg.value, 0);
        }
        _safeMint(v.to, id); // reverts if the name (tokenId) already exists — one live deed per name

        emit Extracted(v.nonce, v.to, id, v.name, v.district);
        if (issuedGameplay) emit GameplayIdentityIssued(v.to, id, gameplayMintedCount);
        if (price != 0) {
            if (saleProceedsRouted) {
                IFeeRevenueRouter(saleProceedsRecipient).route{value: price}(paidPublicCount);
            } else {
                (bool sent,) = saleProceedsRecipient.call{value: price}("");
                if (!sent) revert SalePaymentFailed();
            }
            emit PublicSalePaid(msg.sender, v.to, id, paidPublicCount, price);
        }
    }

    function _consumeDailyMints(uint256 count) private {
        uint256 day = block.timestamp / 1 days;
        uint256 next = mintedOnDay[day] + count;
        require(dailyMintCap == 0 || next <= dailyMintCap, "SD: daily cap");
        mintedOnDay[day] = next;
    }

    /// @notice Burn the deed back toward the game — the on-chain half of re-import. The burn IS the
    ///         ownership proof (only the holder can call it), so no server signature is needed (the
    ///         event is the authority, exactly like GearVault.redeem). The backend watcher re-creates
    ///         the in-game deed on whoever burned it after CHAIN_CONFIRMATIONS. After the burn the token
    ///         no longer exists, so the same street can be re-extracted later with a fresh voucher.
    /// @notice Lock or unlock a deed for transfer. Owner-only — deliberately NOT approved
    ///         operators (see transferLocked). Unlocking is the public "listing" act.
    function setTransferLock(uint256 tokenId, bool locked) external {
        require(ownerOf(tokenId) == msg.sender, "SD: not owner");
        transferLocked[tokenId] = locked;
        emit TransferLockSet(tokenId, locked, msg.sender);
    }

    function redeem(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "SD: not owner"); // reverts if nonexistent — clean
        _burn(tokenId);
        // Keep the immutable name/district for a possible re-extraction of the same identity.
        emit Redeemed(msg.sender, tokenId);
    }

    /// @dev The lock's enforcement point. Mint (from == 0) and burn (to == 0) pass — a claim must
    ///      land and redeem() must never be blocked — but an owner-to-owner transfer requires the
    ///      current owner to have unlocked first, and the deed RE-LOCKS the moment it arrives so
    ///      the default-ON invariant holds for every owner, not just the first.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            require(!transferLocked[tokenId], "SD: locked - unlock before transfer");
        }
        address prev = super._update(to, tokenId, auth);
        if (to == address(0)) delete transferLocked[tokenId]; // burn: clear the slot
        else transferLocked[tokenId] = true; // mint OR arrival: locked
        return prev;
    }

    // ── on-chain metadata ────────────────────────────────────────────────────────────────────────
    // Identity (name + district) is assembled ON-CHAIN, so a marketplace shows the real street even if
    // the game server is down. The image (the block plate) and external_url (the legend page) are the
    // off-chain pointers, which is correct: the plate and the LIVE legend grow with play. Marketing
    // guardrails (design §6) bind this string: property with a history, never "scarce/appreciating land".
    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id); // reverts for a nonexistent/burned token (ERC721NonexistentToken)
        string memory nm = _json(deedName[id]);
        string memory dt = _json(deedDistrict[id]);
        string memory json = string.concat(
            '{"name":"',
            nm,
            '",',
            '"description":"A Street Deed \\u2014 a named, mapped plot in the city of OMERT\\u00c0. Its worth is the story on it: everything that ever happened here. Property with a history.",',
            '"image":"',
            _imageBase,
            id.toString(),
            '.svg",',
            '"external_url":"',
            _externalBase,
            id.toString(),
            '",',
            '"attributes":[',
            '{"trait_type":"Type","value":"Street Deed"},',
            '{"trait_type":"District","value":"',
            dt,
            '"}',
            "]}"
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    // Minimal JSON string sanitizer: a deed name is player-chosen, and the backend already strips
    // < > " at claim (cleanText), but a marketplace parses this document, so we escape the two bytes
    // that could break the JSON regardless — a backslash and a double-quote. Control bytes are not
    // reachable (the name filter drops them), so this is belt-and-braces on the two structural chars.
    function _json(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out = new bytes(b.length * 2);
        uint256 n = 0;
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            if (c == '"' || c == "\\") {
                out[n++] = "\\";
                out[n++] = c;
            } else {
                out[n++] = c;
            }
        }
        bytes memory trimmed = new bytes(n);
        for (uint256 i = 0; i < n; i++) {
            trimmed[i] = out[i];
        }
        return string(trimmed);
    }
}
