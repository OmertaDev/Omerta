// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @dev ERC-5192 exposes the permanent soulbound status to wallets and indexers.
interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    function locked(uint256 tokenId) external view returns (bool);
}

/// @title DynastyNFT — OMERTÀ's identity NFT (omerta-dynasty-machine-design.md §4, omerta-identity-nft-design.md §5).
/// @notice The player's on-chain bloodline identity: a permanently soulbound ERC-721 with ERC-5192
///         discovery. Minting binds it to the receiving wallet; no transfer, burn, or unlock path exists.
///
///         Stock delivery targets the STREET DEED's token-bound account (`src/stockdeliver.js`),
///         not this identity. Character custody of deeds and death settlement require a separate rail;
///         this contract does not implement a token-bound account or confer custody by itself.
///
///         THE WALL (identity §1, dynasty §2.2): the game ENTITLEMENT (`account_persistent.minted`, the
///         wage/withdraw gates) stays ACCOUNT-BOUND in the backend and is NEVER read off `balanceOf`. This
///         contract therefore gates NOTHING on a balance; the login, legends, and extraction entitlement
///         remain separate from on-chain identity ownership.
///
///         SUPPLY IS UNCAPPED (founder rule 1: a cap on the identity would cap the player count). tokenId is
///         a plain sequential counter — a dynasty is not named at mint, and the backend maps tokenId → the
///         owning account off-chain. Minting is a SERVER-SIGNED voucher self-mint (the StreetDeed / OmertaBond
///         precedent): the player pays the ETH mint fee at `OmertaFees.payMintFee()` (the fee rail is
///         unchanged, wave-priced off-chain), the backend then signs a mint voucher, and the player claims
///         their trophy (paying their own gas). There is deliberately NO owner-mint, so "the Safe was
///         compromised" and "identities were minted" stay two separate events (the OMR.minter discipline).
///         A compromised signer is bounded by the daily mint cap (rate), the nonce (no replay), the short
///         deadline (+ a MAX_VOUCHER_TTL backstop), the Safe rotating the signer — and, decisively, that the
///         token carries NO extraction entitlement, so a signer minting trophies to itself steals nothing.
///
///         tokenURI is OFF-CHAIN (the layered portrait compositor), because the portrait is LIVE game history
///         that must resolve to the minting account's current street — a thing the contract cannot know. No
///         mutable street name, no exact field-conjunction and no wealth is engraved on-chain (the
///         wallet↔character firewall + the anti-precise-kill-EV rule); provenance traits are an OPT-IN,
///         DISPLAY-ONLY off-chain metadata attribute and touch nothing here.
contract DynastyNFT is ERC721, ERC2981, IERC5192, EIP712, Ownable2Step, Pausable, ReentrancyGuard {
    using Strings for uint256;

    /// @notice Deadline backstop (VoucherClaim.MAX_VOUCHER_TTL mirror) — a leaked-then-rotated signer key's
    ///         pre-signed vouchers can't stay claimable for months. The server signs far shorter deadlines.
    uint256 public constant MAX_VOUCHER_TTL = 30 days;

    bytes32 public constant MINT_VOUCHER_TYPEHASH = keccak256("MintVoucher(address to,uint256 nonce,uint256 deadline)");

    struct MintVoucher {
        address to; // the wallet that mints (the paying player's linked wallet)
        uint256 nonce; // server-unique; replay protection (also the backend's mint-request key)
        uint256 deadline; // unix seconds
    }

    address public signer;
    uint256 public dailyMintCap; // max identities mintable per UTC day, 0 = unlimited (a leaked-signer rate wall)
    uint256 public nextId = 1; // sequential tokenId; uncapped collection
    mapping(uint256 => bool) public usedNonce;
    mapping(uint256 => uint256) public mintedOnDay; // day => identities minted

    // Off-chain metadata pointer (the layered portrait + LIVE legend). Set by the Safe. tokenURI = <base><id>.
    string private _baseUri;

    event SignerSet(address indexed signer);
    event DailyMintCapSet(uint256 cap);
    event BaseUriSet(string base);
    // `minter` is the permanently bound receiving wallet. `nonce` ties the mint to the backend request.
    event Minted(uint256 indexed nonce, address indexed minter, uint256 indexed tokenId);

    /// @dev `dailyMintCap_` is a CONSTRUCTOR argument rather than a setter-only field on purpose: this
    ///      contract self-mints on the SAME signer key as VoucherClaim/OmertaBond/StreetDeed, so that key's
    ///      blast radius is the SUM of the four daily caps — and with NO supply cap here, an unset wall is
    ///      unbounded. A wall that lives only in a deploy checklist is one a deploy can forget; both
    ///      siblings that take theirs at construction cannot be. 0 still means unlimited (the suite-wide
    ///      convention), so this forces a DECISION at deploy, not a particular number.
    constructor(
        address owner_,
        address signer_,
        string memory baseUri_,
        address royaltyRecipient_,
        uint96 royaltyBps_,
        uint256 dailyMintCap_
    ) ERC721("OMERTA Dynasty", "OMERTA") EIP712("OmertaDynasty", "1") Ownable(owner_) {
        require(signer_ != address(0), "DN: zero signer");
        require(royaltyRecipient_ != address(0), "DN: zero royalty recipient");
        signer = signer_;
        _baseUri = baseUri_;
        _setDefaultRoyalty(royaltyRecipient_, royaltyBps_); // EIP-2981; ERC2981 caps bps at 10000
        dailyMintCap = dailyMintCap_;
        emit DailyMintCapSet(dailyMintCap_);
    }

    // ── admin (the Safe) ──
    function setSigner(address s) external onlyOwner {
        require(s != address(0), "DN: zero signer");
        signer = s;
        emit SignerSet(s);
    }

    function setDailyMintCap(uint256 cap) external onlyOwner {
        dailyMintCap = cap;
        emit DailyMintCapSet(cap);
    }

    function setBaseUri(string calldata base_) external onlyOwner {
        _baseUri = base_;
        emit BaseUriSet(base_);
    }

    /// @notice Rotate the legacy EIP-2981 royalty configuration (recipient + bps). The interface remains
    ///         available for compatibility; it does not make this soulbound token saleable.
    function setDefaultRoyalty(address recipient, uint96 bps) external onlyOwner {
        require(recipient != address(0), "DN: zero royalty recipient");
        _setDefaultRoyalty(recipient, bps); // ERC2981 reverts if bps > 10000
    }

    // Pausing stops new MINTS only. Existing identities are permanently soulbound in either pause state.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ── the mint (a server-signed, fee-gated-off-chain voucher self-mint) ──
    function hashVoucher(MintVoucher calldata v) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(MINT_VOUCHER_TYPEHASH, v.to, v.nonce, v.deadline)));
    }

    /// @notice Mint one identity to `v.to` on a server signature. The tokenId is the next sequential id; the
    ///         backend learns it from the `Minted` event (keyed by nonce → its mint request → the account).
    ///         The extraction entitlement (`minted`) is set in the backend the moment the ETH fee is paid and
    ///         does NOT depend on this trophy being claimed — so a player who never claims still plays fully.
    function claim(MintVoucher calldata v, bytes calldata sig) external nonReentrant whenNotPaused returns (uint256) {
        require(block.timestamp <= v.deadline, "DN: expired");
        require(v.deadline <= block.timestamp + MAX_VOUCHER_TTL, "DN: deadline too far");
        require(v.to != address(0), "DN: zero recipient");
        require(!usedNonce[v.nonce], "DN: replay");
        require(ECDSA.recover(hashVoucher(v), sig) == signer, "DN: bad signature");
        usedNonce[v.nonce] = true;

        uint256 day = block.timestamp / 1 days;
        uint256 newTotal = mintedOnDay[day] + 1;
        require(dailyMintCap == 0 || newTotal <= dailyMintCap, "DN: daily cap");
        mintedOnDay[day] = newTotal;

        uint256 id = nextId++;
        _safeMint(v.to, id);
        emit Minted(v.nonce, v.to, id);
        return id;
    }

    /// @notice Every existing identity is permanently locked to its receiving wallet.
    function locked(uint256 id) external view returns (bool) {
        _requireOwned(id);
        return true;
    }

    /// @dev Enforce the lock at the shared ownership-update boundary, including receiver callbacks and
    ///      approved operators. No public burn path exists; internal non-mint updates are rejected too.
    function _update(address to, uint256 id, address auth) internal override returns (address) {
        require(_ownerOf(id) == address(0), "DN: soulbound");
        address from = super._update(to, id, auth);
        emit Locked(id);
        return from;
    }

    // ── metadata (off-chain, resolves to the minting account's current street) ──
    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id); // reverts for a nonexistent token (ERC721NonexistentToken)
        return string.concat(_baseUri, id.toString());
    }

    // ERC721 + ERC2981 both declare supportsInterface — combine them.
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        return interfaceId == type(IERC5192).interfaceId || super.supportsInterface(interfaceId);
    }
}
