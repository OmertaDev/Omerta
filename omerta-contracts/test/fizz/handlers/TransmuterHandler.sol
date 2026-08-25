// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with Transmuter
abstract contract TransmuterHandler is Properties {
    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function transmuter_fund_clamped(uint256 assets) public {
        uint256 balance = reserveAsset.balanceOf(actor);
        if (balance != 0) assets = clampBetween(assets, 1, balance);
        transmuter_fund(assets);
    }

    function transmuter_redeem_clamped(uint256 debtAmount) public {
        uint256 balance = denari.balanceOf(actor);
        uint256 reserveBound = transmuter.reserves() * transmuter.scale();
        uint256 maxAmount = balance < reserveBound ? balance : reserveBound;
        if (maxAmount >= transmuter.scale()) debtAmount = clampBetween(debtAmount, transmuter.scale(), maxAmount);
        transmuter_redeem(debtAmount);
    }

    function transmuter_secondary(uint8 selector, uint256 arg0, uint256 arg1, address arg2) public {
        selector = uint8(selector % 3);
        if (selector == 0) _transmuter_setBufferFloorBps(uint16(arg0));
        else if (selector == 1) _transmuter_setFunder(arg2, arg0 > 0);
        else _transmuter_setRedeemCaps(arg0, arg1);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function transmuter_fund(uint256 assets) public asActor {
        try transmuter.fund(assets) {} catch {}
    }

    function transmuter_redeem(uint256 debtAmount) public asActor {
        try transmuter.redeem(debtAmount) {} catch {}
    }

    function _transmuter_setBufferFloorBps(uint16 bps) internal {
        bps = uint16(uint256(bps) % (transmuter.BPS() + 1));
        try transmuter.setBufferFloorBps(bps) {} catch {}
    }

    function _transmuter_setFunder(address who, bool allowed) internal {
        who = uint160(who) % 2 == 0 ? toActor(who) : address(this);
        try transmuter.setFunder(who, allowed) {} catch {}
    }

    function _transmuter_setRedeemCaps(uint256 perBlock, uint256 perDay) internal {
        perBlock %= 1_000_000 * USDC_UNIT + 1;
        perDay %= 10_000_000 * USDC_UNIT + 1;
        try transmuter.setRedeemCaps(perBlock, perDay) {} catch {}
    }
}
