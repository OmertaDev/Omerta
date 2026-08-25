// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with OmertaHook
abstract contract OmertaHookHandler is Properties {
    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function omertaHook_sweep_clamped(address currency) public {
        // TODO: clamp currency — e.g. currency = toActor(currency);
        omertaHook_sweep(currency);
    }

    function omertaHook_secondary(
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
        selector = uint8(selector % 6);
        if (selector == 0) _omertaHook_setAllowedQuote(arg4, arg0 > 0);
        else if (selector == 1) _omertaHook_setAntiSnipe(arg0, arg1, arg2);
        else if (selector == 2) _omertaHook_setObserver(arg4);
        else if (selector == 3) _omertaHook_setRecipients(arg4, arg5, arg6, arg7);
        else if (selector == 4) _omertaHook_setSellTax(arg0, arg1, arg2, arg3);
        else _omertaHook_setSurge(arg0, arg1);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function omertaHook_sweep(address currency) public asActor {
        // TODO: wire call — omertaHook.sweep(currency);
    }

    function _omertaHook_setAllowedQuote(address currency, bool allowed) internal {
        // TODO: wire call — omertaHook.setAllowedQuote(currency, allowed);
    }

    function _omertaHook_setAntiSnipe(uint256 blocks_, uint256 buyBps, uint256 maxBuy) internal {
        // TODO: wire call — omertaHook.setAntiSnipe(blocks_, buyBps, maxBuy);
    }

    function _omertaHook_setObserver(address observer_) internal {
        // TODO: wire call — omertaHook.setObserver(observer_);
    }

    function _omertaHook_setRecipients(address dev, address rwa, address community, address lp) internal {
        // TODO: wire call — omertaHook.setRecipients(dev, rwa, community, lp);
    }

    function _omertaHook_setSellTax(uint256 bps, uint256 devBps, uint256 rwaBps, uint256 communityBps) internal {
        // TODO: wire call — omertaHook.setSellTax(bps, devBps, rwaBps, communityBps);
    }

    function _omertaHook_setSurge(uint256 maxBps, uint256 fullBps) internal {
        // TODO: wire call — omertaHook.setSurge(maxBps, fullBps);
    }
}
