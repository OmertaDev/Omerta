// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with GearVault
abstract contract GearVaultHandler is Properties {
    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function gearVault_mint_clamped(address to, uint256 tokenId, uint256 amount) public {
        to = toActor(to);
        tokenId = clampBetween(tokenId, 1, 8);
        uint256 live = gearVault.minted(tokenId) - gearVault.redeemed(tokenId);
        uint256 headroom = gearVault.cap(tokenId) - live;
        if (headroom != 0) amount = clampBetween(amount, 1, headroom);
        gearVault_mint(to, tokenId, amount);
    }

    function gearVault_redeem_clamped(uint256 tokenId, uint256 amount) public {
        tokenId = clampBetween(tokenId, 1, 8);
        amount = gearVault.balanceOf(actor, tokenId) == 0 ? 0 : 1;
        gearVault_redeem(tokenId, amount);
    }

    function gearVault_secondary(uint8 selector, uint256 arg0, uint256 arg1, address arg2) public {
        selector = uint8(selector % 2);
        if (selector == 0) _gearVault_setGearCap(arg0, arg1);
        else _gearVault_setMinter(arg2);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function gearVault_mint(address to, uint256 tokenId, uint256 amount) public {
        address currentMinter = gearVault.minter();
        if (currentMinter == address(0)) return;
        vm.startPrank(currentMinter);
        try gearVault.mint(to, tokenId, amount) {} catch {}
        vm.stopPrank();
    }

    function gearVault_redeem(uint256 tokenId, uint256 amount) public asActor {
        try gearVault.redeem(tokenId, amount) {} catch {}
    }

    function _gearVault_setGearCap(uint256 tokenId, uint256 c) internal {
        tokenId = tokenId % 8 + 1;
        uint256 live = gearVault.minted(tokenId) - gearVault.redeemed(tokenId);
        c = clampBetween(c, live, 1_000_000);
        try gearVault.setGearCap(tokenId, c) {} catch {}
    }

    function _gearVault_setMinter(address m) internal {
        m = uint160(m) % 2 == 0 ? address(this) : toActor(m);
        try gearVault.setMinter(m) {} catch {}
    }
}
