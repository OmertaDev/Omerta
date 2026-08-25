// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with OMR
abstract contract OMRHandler is Properties {
    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function oMR_approve_clamped(address spender, uint256 value) public {
        spender = toActor(spender);
        value = clampLte(value, oMR.balanceOf(actor));
        oMR_approve(spender, value);
    }

    function oMR_mint_clamped(address to, uint256 amount) public {
        to = toActor(to);
        amount = clampBetween(amount, 1, 1_000_000 ether);
        oMR_mint(to, amount);
    }

    function oMR_transfer_clamped(address to, uint256 value) public {
        to = toActorNotCurrent(to);
        value = clampLte(value, oMR.balanceOf(actor));
        oMR_transfer(to, value);
    }

    function oMR_transferFrom_clamped(address from, address to, uint256 value) public {
        from = actor;
        to = toActorNotCurrent(to);
        value = clampLte(value, oMR.balanceOf(from));
        oMR_transferFrom(from, to, value);
    }

    function oMR_secondary(
        uint8 selector,
        uint256 arg0,
        uint256 arg1,
        uint256 arg2,
        uint256 arg3,
        address arg4,
        address arg5,
        address arg6,
        address arg7
    ) public {
        selector = uint8(selector % 5);
        if (selector == 0) _oMR_setExempt(arg4, arg0 > 0);
        else if (selector == 1) _oMR_setMinter(arg4);
        else if (selector == 2) _oMR_setPair(arg4, arg0 > 0);
        else if (selector == 3) _oMR_setSellTax(arg0, arg1, arg2, arg3);
        else _oMR_setTaxRecipients(arg4, arg5, arg6, arg7);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function oMR_approve(address spender, uint256 value) public asActor {
        try oMR.approve(spender, value) {} catch {}
    }

    function oMR_mint(address to, uint256 amount) public {
        address currentMinter = oMR.minter();
        if (currentMinter == address(0)) return;
        vm.startPrank(currentMinter);
        try oMR.mint(to, amount) {} catch {}
        vm.stopPrank();
    }

    function oMR_transfer(address to, uint256 value) public asActor {
        try oMR.transfer(to, value) {} catch {}
    }

    function oMR_transferFrom(address from, address to, uint256 value) public asActor {
        try oMR.transferFrom(from, to, value) {} catch {}
    }

    function _oMR_setExempt(address account, bool exempt) internal {
        account = toActor(account);
        try oMR.setExempt(account, exempt) {} catch {}
    }

    function _oMR_setMinter(address m) internal {
        m = uint160(m) % 2 == 0 ? address(this) : toActor(m);
        try oMR.setMinter(m) {} catch {}
    }

    function _oMR_setPair(address pair, bool isPair) internal {
        pair = toActor(pair);
        try oMR.setPair(pair, isPair) {} catch {}
    }

    function _oMR_setSellTax(uint256 bps, uint256 devBps, uint256 rwaBps, uint256 communityBps) internal {
        bps %= oMR.MAX_SELL_TAX_BPS() + 1;
        devBps %= bps + 1;
        rwaBps %= bps - devBps + 1;
        communityBps %= bps - devBps - rwaBps + 1;
        try oMR.setSellTax(bps, devBps, rwaBps, communityBps) {} catch {}
    }

    function _oMR_setTaxRecipients(address dev, address rwa, address community, address lp) internal {
        dev = toActor(dev);
        rwa = toActor(rwa);
        community = toActor(community);
        lp = address(this);
        try oMR.setTaxRecipients(dev, rwa, community, lp) {} catch {}
    }
}
