// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with OMRStaking
abstract contract OMRStakingHandler is Properties {
    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function oMRStaking_claimRewards_clamped() public {
        oMRStaking_claimRewards();
    }

    function oMRStaking_fundRewards_clamped(uint256 amount) public {
        uint256 balance = oMR.balanceOf(actor);
        if (balance != 0) amount = clampBetween(amount, 1, balance);
        oMRStaking_fundRewards(amount);
    }

    function oMRStaking_stake_clamped(uint256 amount) public {
        uint256 balance = oMR.balanceOf(actor);
        if (balance != 0) amount = clampBetween(amount, 1, balance);
        oMRStaking_stake(amount);
    }

    function oMRStaking_unstake_clamped(uint256 amount) public {
        (uint256 staked,,) = oMRStaking.positions(actor);
        if (staked != 0) amount = clampBetween(amount, 1, staked);
        oMRStaking_unstake(amount);
    }

    function oMRStaking_secondary(uint8 selector, uint256 arg0) public {
        selector = uint8(selector % 1);
        if (selector == 0) _oMRStaking_setApy(arg0);
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function oMRStaking_claimRewards() public asActor {
        try oMRStaking.claimRewards() {} catch {}
    }

    function oMRStaking_fundRewards(uint256 amount) public asActor {
        try oMRStaking.fundRewards(amount) {} catch {}
    }

    function oMRStaking_stake(uint256 amount) public asActor {
        try oMRStaking.stake(amount) {} catch {}
    }

    function oMRStaking_unstake(uint256 amount) public asActor {
        try oMRStaking.unstake(amount) {} catch {}
    }

    function _oMRStaking_setApy(uint256 bps) internal {
        bps %= oMRStaking.MAX_APY_BPS() + 1;
        try oMRStaking.setApy(bps) {} catch {}
    }
}
