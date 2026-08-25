// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with Denari
abstract contract DenariHandler is Properties {
    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function denari_approve_clamped(address spender, uint256 value) public {
        spender = uint160(spender) % 2 == 0 ? address(transmuter) : toActor(spender);
        value = clampLte(value, denari.balanceOf(actor));
        denari_approve(spender, value);
    }

    function denari_transfer_clamped(address to, uint256 value) public {
        to = toActorNotCurrent(to);
        value = clampLte(value, denari.balanceOf(actor));
        denari_transfer(to, value);
    }

    function denari_transferFrom_clamped(address from, address to, uint256 value) public {
        from = actor;
        to = toActorNotCurrent(to);
        value = clampLte(value, denari.balanceOf(from));
        denari_transferFrom(from, to, value);
    }

    function denari_secondary(uint8 selector, address arg0) public {
        selector = uint8(selector % 2);
        if (selector == 0) _denari_setBurner(arg0);
        else _denari_setMinter(arg0);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function denari_approve(address spender, uint256 value) public asActor {
        try denari.approve(spender, value) {} catch {}
    }

    function denari_transfer(address to, uint256 value) public asActor {
        try denari.transfer(to, value) {} catch {}
    }

    function denari_transferFrom(address from, address to, uint256 value) public asActor {
        try denari.transferFrom(from, to, value) {} catch {}
    }

    function _denari_setBurner(address b) internal {
        b = uint160(b) % 2 == 0 ? address(transmuter) : toActor(b);
        try denari.setBurner(b) {} catch {}
    }

    function _denari_setMinter(address m) internal {
        m = uint160(m) % 2 == 0 ? address(alchemist) : toActor(m);
        try denari.setMinter(m) {} catch {}
    }
}
