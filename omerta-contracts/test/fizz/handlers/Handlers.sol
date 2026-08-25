// SPDX-License-Identifier: MIT
pragma solidity >=0.6.2 <0.9.0;

import "../Base.sol";
import {AlchemistHandler} from "./AlchemistHandler.sol";
import {DenariHandler} from "./DenariHandler.sol";
import {GearVaultHandler} from "./GearVaultHandler.sol";
import {OMRHandler} from "./OMRHandler.sol";
import {OMRStakingHandler} from "./OMRStakingHandler.sol";
import {OmrTwapOracleHandler} from "./OmrTwapOracleHandler.sol";
import {StockVaultHandler} from "./StockVaultHandler.sol";
import {TransmuterHandler} from "./TransmuterHandler.sol";

/// @notice Inherits from all the handlers to expose all entry points in a single contract.
///         Manages environment changes (e.g. current actor, current token, mocks setup, etc.).
abstract contract Handlers is
    AlchemistHandler,
    DenariHandler,
    GearVaultHandler,
    OMRHandler,
    OMRStakingHandler,
    OmrTwapOracleHandler,
    StockVaultHandler,
    TransmuterHandler
{
    function setCurrentActor(uint256 entropy) public {
        actor = actors[entropy % actors.length];
    }

    function environment_advance(uint256 secondsForward) public {
        skipTime(secondsForward % 30 days + 1);
    }

    function environment_vaultYield(uint256 amount) public {
        amount %= 1_000_000 * USDC_UNIT + 1;
        if (amount != 0) yieldVault.earn(amount);
    }

    function environment_twapReserves(uint112 reserve0, uint112 reserve1) public {
        reserve0 = uint112(uint256(reserve0) % 1_000_000 ether + 1 ether);
        reserve1 = uint112(uint256(reserve1) % 1_000_000_000 ether + 1 ether);
        fuzzPair.setReserves(reserve0, reserve1);
    }
}
