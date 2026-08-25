// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Snapshots} from "./Snapshots.sol";
import {PropertiesAsserts} from "./utils/PropertiesAsserts.sol";

/// @notice Cross-contract properties exercised by Foundry, Medusa, and Echidna.
abstract contract Properties is PropertiesAsserts, Snapshots {
    function property_bank_supply_has_debt_or_reserve_backing() public returns (bool) {
        uint256 aggregateDebt;
        for (uint256 i; i < actors.length; ++i) {
            aggregateDebt += alchemist.debtOf(actors[i]);
        }
        uint256 backing = aggregateDebt + transmuter.reserves() * transmuter.scale();
        gte(backing, denari.totalSupply(), "DNR supply exceeds debt plus scaled reserves");
        return true;
    }

    function property_transmuter_ledger_is_physically_funded() public returns (bool) {
        gte(
            reserveAsset.balanceOf(address(transmuter)),
            transmuter.reserves(),
            "tracked reserves exceed physical reserve-token balance"
        );
        return true;
    }

    function property_actor_debt_is_within_reported_ltv() public returns (bool) {
        for (uint256 i; i < actors.length; ++i) {
            lte(alchemist.debtOf(actors[i]), alchemist.maxDebtOf(actors[i]), "actor debt exceeds reported LTV");
        }
        return true;
    }

    function property_ltv_and_harvest_fee_are_compatible() public returns (bool) {
        lte(
            uint256(alchemist.ltvBps()) + uint256(alchemist.harvestFeeBps()),
            alchemist.BPS(),
            "LTV plus harvest fee exceeds 100%"
        );
        return true;
    }

    function property_staking_principal_sum_matches_global_total() public returns (bool) {
        uint256 aggregateStake;
        for (uint256 i; i < actors.length; ++i) {
            (uint256 stakeAmount,,) = oMRStaking.positions(actors[i]);
            aggregateStake += stakeAmount;
        }
        eq(aggregateStake, oMRStaking.totalStaked(), "per-user stake sum differs from totalStaked");
        return true;
    }

    function property_staking_balance_covers_accounted_principal_and_pool() public returns (bool) {
        gte(
            oMR.balanceOf(address(oMRStaking)),
            oMRStaking.totalStaked() + oMRStaking.rewardPool(),
            "staking OMR balance is below principal plus reward pool"
        );
        return true;
    }

    function property_staking_apy_is_hard_capped() public returns (bool) {
        lte(oMRStaking.apyBps(), oMRStaking.MAX_APY_BPS(), "staking APY exceeds hard cap");
        return true;
    }

    function property_omr_tax_configuration_is_bounded() public returns (bool) {
        lte(oMR.sellTaxBps(), oMR.MAX_SELL_TAX_BPS(), "OMR tax exceeds hard cap");
        lte(
            oMR.taxDevBps() + oMR.taxRwaBps() + oMR.taxCommunityBps(),
            oMR.sellTaxBps(),
            "OMR tax slices exceed total tax"
        );
        gte(oMR.totalSupply(), oMR.SUPPLY(), "OMR supply fell below founding supply");
        return true;
    }

    function property_gear_live_supply_is_capped() public returns (bool) {
        for (uint256 id = 1; id <= 8; ++id) {
            uint256 minted = gearVault.minted(id);
            uint256 redeemed = gearVault.redeemed(id);
            gte(minted, redeemed, "gear redeemed counter exceeds minted counter");
            lte(minted - redeemed, gearVault.cap(id), "gear live supply exceeds cap");
        }
        return true;
    }

    function property_twap_period_respects_floor() public returns (bool) {
        gte(omrTwapOracle.PERIOD(), omrTwapOracle.MIN_PERIOD(), "TWAP period is below hard floor");
        return true;
    }
}
