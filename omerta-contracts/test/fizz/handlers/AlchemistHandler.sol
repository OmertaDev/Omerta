// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with Alchemist
abstract contract AlchemistHandler is Properties {
    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function alchemist_deposit_clamped(uint256 assets) public {
        uint256 balance = reserveAsset.balanceOf(actor);
        if (balance != 0) assets = clampBetween(assets, 1, balance);
        alchemist_deposit(assets);
    }

    function alchemist_harvest_clamped(address user) public {
        alchemist_harvest(toActor(user));
    }

    function alchemist_mint_clamped(uint256 debtAmount) public {
        skipBlocks(1);
        uint256 maxDebt = alchemist.maxDebtOf(actor);
        uint256 debt = alchemist.debtOf(actor);
        if (maxDebt > debt) {
            uint256 availableDebt = maxDebt - debt;
            uint256 supply = denari.totalSupply();
            uint256 floorBps = transmuter.bufferFloorBps();
            uint256 numerator = (transmuter.reserves() + 1) * transmuter.scale() * transmuter.BPS();
            uint256 firstUnhealthySupply = (numerator + floorBps - 1) / floorBps;

            // Prefer the exact first supply that makes requiredBuffer exceed reserves. This
            // boundary is otherwise a very thin target inside a 256-bit random amount domain.
            if (firstUnhealthySupply > supply && firstUnhealthySupply - supply <= availableDebt) {
                debtAmount = firstUnhealthySupply - supply;
            } else {
                debtAmount = clampBetween(debtAmount, 1, availableDebt);
            }
        }
        alchemist_mint(debtAmount);
    }

    function alchemist_repay_clamped(uint256 assets) public {
        uint256 debt = alchemist.debtOf(actor);
        uint256 balance = reserveAsset.balanceOf(actor);
        uint256 maxAssets = (debt + alchemist.scale() - 1) / alchemist.scale();
        if (maxAssets > balance) maxAssets = balance;
        if (maxAssets != 0) assets = clampBetween(assets, 1, maxAssets);
        alchemist_repay(assets);
    }

    function alchemist_sweepFees_clamped() public {
        alchemist_sweepFees();
    }

    function alchemist_withdraw_clamped(uint256 assets) public {
        skipBlocks(1);
        uint256 collateral = alchemist.collateralOf(actor);
        uint256 debt = alchemist.debtOf(actor);
        uint256 denominator = alchemist.scale() * alchemist.ltvBps();
        uint256 needed = denominator == 0 ? collateral : (debt * alchemist.BPS() + denominator - 1) / denominator;
        uint256 available = collateral > needed ? collateral - needed : 0;
        if (available != 0) assets = clampBetween(assets, 1, available);
        alchemist_withdraw(assets);
    }

    function alchemist_secondary(uint8 selector, uint256 arg0, uint256 arg1, address arg2) public {
        selector = uint8(selector % 3);
        if (selector == 0) _alchemist_setHarvestFee(uint16(arg0), arg2);
        else if (selector == 1) _alchemist_setLtvBps(uint16(arg0));
        else _alchemist_setMintCaps(arg0, arg1);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function alchemist_deposit(uint256 assets) public asActor {
        try alchemist.deposit(assets, 1) {} catch {}
    }

    function alchemist_harvest(address user) public asActor {
        try alchemist.harvest(user) {} catch {}
    }

    function alchemist_mint(uint256 debtAmount) public asActor {
        try alchemist.mint(debtAmount) {
            t(transmuter.bufferHealthy(), "a successful mint left the Transmuter below its reserve floor");
        } catch {}
    }

    function alchemist_repay(uint256 assets) public asActor {
        try alchemist.repay(assets) {} catch {}
    }

    function alchemist_sweepFees() public asActor {
        try alchemist.sweepFees() {} catch {}
    }

    function alchemist_withdraw(uint256 assets) public asActor {
        try alchemist.withdraw(assets) {} catch {}
    }

    function _alchemist_setHarvestFee(uint16 bps, address recipient) internal {
        bps = uint16(uint256(bps) % (alchemist.MAX_HARVEST_FEE_BPS() + 1));
        recipient = uint160(recipient) % 4 == 0 ? address(0) : toActor(recipient);
        try alchemist.setHarvestFee(bps, recipient) {} catch {}
    }

    function _alchemist_setLtvBps(uint16 bps) internal {
        bps = uint16(uint256(bps) % (alchemist.MAX_LTV_BPS() + 1));
        try alchemist.setLtvBps(bps) {} catch {}
    }

    function _alchemist_setMintCaps(uint256 perBlock, uint256 perDay) internal {
        perBlock = perBlock % (1_000_000 ether + 1);
        perDay = perDay % (10_000_000 ether + 1);
        try alchemist.setMintCaps(perBlock, perDay) {} catch {}
    }
}
