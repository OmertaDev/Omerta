// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {Properties} from "../Properties.sol";

/// @notice Handles the interaction with OmrTwapOracle
abstract contract OmrTwapOracleHandler is Properties {
    // ――――――――――――――――――――――――― Clamped ――――――――――――――――――――――――――

    function omrTwapOracle_update_clamped() public {
        uint256 due = uint256(omrTwapOracle.lastUpdate()) + omrTwapOracle.PERIOD();
        if (omrTwapOracle.lastUpdate() == 0) due = omrTwapOracle.PERIOD();
        if (block.timestamp <= due) skipTime(due - block.timestamp + 1);
        omrTwapOracle_update();
    }

    // ―――――――――――――――――――――――― Unclamped ―――――――――――――――――――――――――

    function omrTwapOracle_update() public asActor {
        try omrTwapOracle.update() {} catch {}
    }
}
