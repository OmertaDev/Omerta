// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with StockVault
abstract contract StockVaultHandler is Properties {
    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function stockVault_deliver_clamped(uint256 deliveryId, address token, address to, uint256 units) public {
        token = address(reserveAsset);
        to = toActor(to);
        uint256 balance = reserveAsset.balanceOf(address(stockVault));
        uint256 cap = stockVault.effectiveDailyCap(token);
        uint256 day = block.timestamp / 1 days;
        uint256 used = stockVault.deliveredOnDay(token, day);
        uint256 available = cap == 0 ? balance : (cap > used ? cap - used : 0);
        if (available > balance) available = balance;
        if (available != 0) units = clampBetween(units, 1, available);
        stockVault_deliver(deliveryId, token, to, units);
    }

    function stockVault_deliverBatch_clamped(
        uint256[] memory deliveryIds,
        address[] memory tokens,
        address[] memory tos,
        uint256[] memory unitsArr
    ) public {
        if (
            deliveryIds.length > 4 || tokens.length != deliveryIds.length || tos.length != deliveryIds.length
                || unitsArr.length != deliveryIds.length
        ) return;
        for (uint256 i; i < deliveryIds.length; ++i) {
            tokens[i] = address(reserveAsset);
            tos[i] = toActor(tos[i]);
            unitsArr[i] = unitsArr[i] % (10_000 * USDC_UNIT) + 1;
        }
        stockVault_deliverBatch(deliveryIds, tokens, tos, unitsArr);
    }

    function stockVault_secondary(uint8 selector, uint256 arg0, address arg1) public {
        selector = uint8(selector % 5);
        if (selector == 0) _stockVault_pause();
        else if (selector == 1) _stockVault_setDailyCap(arg1, arg0);
        else if (selector == 2) _stockVault_setDefaultDailyCap(arg0);
        else if (selector == 3) _stockVault_setKeeper(arg1);
        else _stockVault_unpause();
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function stockVault_deliver(uint256 deliveryId, address token, address to, uint256 units) public {
        address currentKeeper = stockVault.keeper();
        if (currentKeeper == address(0)) return;
        vm.startPrank(currentKeeper);
        try stockVault.deliver(deliveryId, token, to, units) {} catch {}
        vm.stopPrank();
    }

    function stockVault_deliverBatch(
        uint256[] memory deliveryIds,
        address[] memory tokens,
        address[] memory tos,
        uint256[] memory unitsArr
    ) public {
        address currentKeeper = stockVault.keeper();
        if (currentKeeper == address(0)) return;
        vm.startPrank(currentKeeper);
        try stockVault.deliverBatch(deliveryIds, tokens, tos, unitsArr) {} catch {}
        vm.stopPrank();
    }

    function _stockVault_pause() internal {
        try stockVault.pause() {} catch {}
    }

    function _stockVault_setDailyCap(address token, uint256 cap) internal {
        token = address(reserveAsset);
        cap %= 10_000_000 * USDC_UNIT + 1;
        try stockVault.setDailyCap(token, cap) {} catch {}
    }

    function _stockVault_setDefaultDailyCap(uint256 cap) internal {
        cap %= 10_000_000 * USDC_UNIT + 1;
        try stockVault.setDefaultDailyCap(cap) {} catch {}
    }

    function _stockVault_setKeeper(address k) internal {
        k = uint160(k) % 2 == 0 ? address(this) : toActor(k);
        try stockVault.setKeeper(k) {} catch {}
    }

    function _stockVault_unpause() internal {
        try stockVault.unpause() {} catch {}
    }
}
