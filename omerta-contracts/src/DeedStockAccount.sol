// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IDeedCustodyView {
    function isLifeAccount(address account) external view returns (bool);
    function deedVault(uint256 deedId) external view returns (address);
}

/// @title DeedStockAccount
/// @notice Constrained ERC-6551 implementation for a Street Deed's canonical stock account.
/// @dev The immutable custody/collection and canonical registry salt are deployment configuration.
///      There is deliberately NO generic execution, approval, delegatecall, or signature delegation,
///      even before equipping. Existing generic accounts and their allowances are not secured by
///      deploying this implementation: their balances need an explicit, independently checked migration.
///      The lock applies to ordinary ERC-20 balances in this account; token issuers retain any seizure,
///      upgrade, transfer restriction, rebasing or other authority present in their token contracts.
contract DeedStockAccount is IERC165, IERC1271, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IDeedCustodyView public immutable custody;
    address public immutable deed;
    uint256 public state;

    event ERC20Withdrawn(address indexed token, address indexed owner, uint256 amount);
    event NativeWithdrawn(address indexed owner, uint256 amount);

    constructor(address custody_, address deed_) {
        require(custody_ != address(0) && deed_ != address(0), "DSA: zero config");
        custody = IDeedCustodyView(custody_);
        deed = deed_;
    }

    receive() external payable {}

    /// @notice Read the immutable ERC-6551 proxy footer emitted by the canonical registry.
    function token() public view returns (uint256 chainId, address tokenContract, uint256 tokenId) {
        bytes memory footer = new bytes(0x60);
        assembly ("memory-safe") {
            extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60)
        }
        return abi.decode(footer, (uint256, address, uint256));
    }

    function owner() public view returns (address) {
        (uint256 chainId, address collection, uint256 id) = token();
        require(chainId == block.chainid && collection == deed, "DSA: wrong binding");
        require(address(this) == custody.deedVault(id), "DSA: noncanonical account");
        return IERC721(deed).ownerOf(id);
    }

    /// @notice Withdraw only to the current direct NFT owner, while the deed is unequipped.
    /// @dev No spending allowances can be created by this account. A deed transfer immediately changes
    ///      withdrawal authority; equipping locks all assets without relying on receiver callbacks.
    function withdrawERC20(address tokenAddress, uint256 amount) external nonReentrant {
        address holder = owner();
        require(!custody.isLifeAccount(holder), "DSA: equipped");
        require(msg.sender == holder, "DSA: not owner");
        ++state;
        IERC20(tokenAddress).safeTransfer(holder, amount);
        emit ERC20Withdrawn(tokenAddress, holder, amount);
    }

    /// @notice Recover native currency only to the unequipped deed's current direct owner.
    function withdrawNative(uint256 amount) external nonReentrant {
        address holder = owner();
        require(!custody.isLifeAccount(holder), "DSA: equipped");
        require(msg.sender == holder, "DSA: not owner");
        ++state;
        (bool ok,) = payable(holder).call{value: amount}("");
        require(ok, "DSA: native transfer failed");
        emit NativeWithdrawn(holder, amount);
    }

    /// @dev Additional ERC-6551 authorization logic deliberately invalidates every delegated signer.
    function isValidSigner(address, bytes calldata) external pure returns (bytes4) {
        return bytes4(0);
    }

    function isValidSignature(bytes32, bytes memory) external pure returns (bytes4) {
        return bytes4(0xffffffff);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC165).interfaceId || interfaceId == 0x6faff5f1
            || interfaceId == type(IERC1271).interfaceId;
    }
}
